"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Member } from "@/entities/types";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { getMemberIdFromAccessToken } from "@/shared/lib/auth-token";
import { isSafeInternalPath } from "@/shared/lib/format";

const ACCESS_TOKEN_KEY = "bbangbat.access-token";
const RETURN_TO_KEY = "bbangbat.return-to";
const EXPLICIT_LOGOUT_KEY = "bbangbat.explicit-logout";

type AuthStatus = "initializing" | "authenticated" | "anonymous";

type AuthContextValue = {
  accessToken: string | null;
  memberId: string | null;
  member: Member | null;
  status: AuthStatus;
  acceptAccessToken: (accessToken: string) => Promise<void>;
  beginSocialLogin: (provider: "kakao" | "naver", returnTo?: string) => void;
  consumeReturnTo: () => string;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function storeAccessToken(accessToken: string | null) {
  if (accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

function setExplicitLogout(loggedOut: boolean) {
  if (loggedOut) {
    sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, "true");
  } else {
    sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
  }
}

function isExplicitlyLoggedOut() {
  return sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === "true";
}

function isAuthHandoffPath(pathname: string) {
  return pathname === "/oauth2/callback" || pathname === "/signup";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const memberId = useMemo(
    () => (accessToken ? getMemberIdFromAccessToken(accessToken) : null),
    [accessToken],
  );

  const establishSession = useCallback(async (token: string) => {
    const nextMemberId = getMemberIdFromAccessToken(token);
    if (!nextMemberId) throw new Error("로그인 토큰에서 회원 정보를 확인하지 못했어요.");
    const nextMember = await bbangbatApi.getMe(nextMemberId, token);
    setExplicitLogout(false);
    storeAccessToken(token);
    setAccessToken(token);
    setMember(nextMember);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    storeAccessToken(null);
    setAccessToken(null);
    setMember(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (isAuthHandoffPath(window.location.pathname)) {
        if (active) setStatus("anonymous");
        return;
      }

      if (isExplicitlyLoggedOut()) {
        storeAccessToken(null);
        if (active) setStatus("anonymous");
        return;
      }

      const storedToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);

      const storedMemberId = storedToken ? getMemberIdFromAccessToken(storedToken) : null;

      if (storedToken && storedMemberId) {
        try {
          const storedMember = await bbangbatApi.getMe(storedMemberId, storedToken);
          if (!active || isExplicitlyLoggedOut()) return;
          setAccessToken(storedToken);
          setMember(storedMember);
          setStatus("authenticated");
          return;
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) {
            if (active) setStatus("anonymous");
            return;
          }
        }
      }

      try {
        const refreshed = await bbangbatApi.refreshToken();
        const refreshedMemberId = getMemberIdFromAccessToken(refreshed.accessToken);
        if (!refreshedMemberId) throw new Error("갱신된 토큰에 회원 정보가 없어요.");
        const refreshedMember = await bbangbatApi.getMe(refreshedMemberId, refreshed.accessToken);
        if (!active || isExplicitlyLoggedOut()) return;
        storeAccessToken(refreshed.accessToken);
        setAccessToken(refreshed.accessToken);
        setMember(refreshedMember);
        setStatus("authenticated");
      } catch {
        if (!active) return;
        storeAccessToken(null);
        setAccessToken(null);
        setMember(null);
        setStatus("anonymous");
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const acceptAccessToken = useCallback(
    async (token: string) => {
      await establishSession(token);
      await queryClient.invalidateQueries();
    },
    [establishSession, queryClient],
  );

  const beginSocialLogin = useCallback(
    (provider: "kakao" | "naver", returnTo = "/") => {
      const safeReturnTo = isSafeInternalPath(returnTo) ? returnTo : "/";
      setExplicitLogout(false);
      sessionStorage.setItem(RETURN_TO_KEY, safeReturnTo);
      window.location.assign(bbangbatApi.socialLoginUrl(provider, window.location.origin));
    },
    [],
  );

  const consumeReturnTo = useCallback(() => {
    const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    return isSafeInternalPath(returnTo) ? returnTo : "/";
  }, []);

  const logout = useCallback(async () => {
    setExplicitLogout(true);
    try {
      if (accessToken) await bbangbatApi.logout(accessToken);
    } catch {
      // 서버 로그아웃이 실패해도 브라우저 세션은 반드시 종료한다.
    } finally {
      clearSession();
      queryClient.clear();
    }
  }, [accessToken, clearSession, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      memberId,
      member,
      status,
      acceptAccessToken,
      beginSocialLogin,
      consumeReturnTo,
      logout,
    }),
    [
      accessToken,
      memberId,
      member,
      status,
      acceptAccessToken,
      beginSocialLogin,
      consumeReturnTo,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

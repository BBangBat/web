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
import {
  getAccessTokenExpiresAt,
  getMemberIdFromAccessToken,
} from "@/shared/lib/auth-token";
import { isSafeInternalPath } from "@/shared/lib/format";

const ACCESS_TOKEN_KEY = "bbangbat.access-token";
const MEMBER_SESSION_KEY = "bbangbat.member-session";
const RETURN_TO_KEY = "bbangbat.return-to";
const EXPLICIT_LOGOUT_KEY = "bbangbat.explicit-logout";
const REFRESH_EARLY_MS = 2 * 60 * 1_000;
const REFRESH_RETRY_MS = 60 * 1_000;
const FALLBACK_REFRESH_MS = 25 * 60 * 1_000;
const MEMBER_RETRY_MS = 15 * 1_000;

type AuthStatus = "initializing" | "authenticated" | "anonymous";

type AuthContextValue = {
  accessToken: string | null;
  memberId: string | null;
  member: Member | null;
  status: AuthStatus;
  updateMember: (member: Member) => void;
  acceptAccessToken: (accessToken: string) => Promise<void>;
  prepareSocialLogin: (returnTo?: string) => void;
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

function storeMemberSession(memberId: string, member: Member) {
  sessionStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify({ memberId, member }));
}

function readMemberSession(memberId: string): Member | null {
  try {
    const raw = sessionStorage.getItem(MEMBER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { memberId?: unknown; member?: Partial<Member> };
    if (
      parsed.memberId !== memberId
      || !parsed.member
      || typeof parsed.member.id !== "number"
      || typeof parsed.member.email !== "string"
      || typeof parsed.member.name !== "string"
      || typeof parsed.member.nickname !== "string"
    ) return null;
    return parsed.member as Member;
  } catch {
    return null;
  }
}

function clearMemberSession() {
  sessionStorage.removeItem(MEMBER_SESSION_KEY);
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

function isAuthenticationFailure(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
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

  const updateMember = useCallback((nextMember: Member) => {
    if (!memberId) return;
    storeMemberSession(memberId, nextMember);
    setMember(nextMember);
  }, [memberId]);

  const establishSession = useCallback(async (token: string) => {
    const nextMemberId = getMemberIdFromAccessToken(token);
    if (!nextMemberId) throw new Error("로그인 토큰에서 회원 정보를 확인하지 못했어요.");
    const nextMember = await bbangbatApi.getMe(nextMemberId, token);
    setExplicitLogout(false);
    storeAccessToken(token);
    storeMemberSession(nextMemberId, nextMember);
    setAccessToken(token);
    setMember(nextMember);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    storeAccessToken(null);
    clearMemberSession();
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
        clearMemberSession();
        if (active) setStatus("anonymous");
        return;
      }

      const storedToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
      const storedMemberId = storedToken ? getMemberIdFromAccessToken(storedToken) : null;
      const cachedMember = storedMemberId ? readMemberSession(storedMemberId) : null;
      let recoverableToken = storedToken;
      let refreshSucceeded = false;

      if (storedToken && storedMemberId) {
        try {
          const storedMember = await bbangbatApi.getMe(storedMemberId, storedToken);
          if (!active || isExplicitlyLoggedOut()) return;
          storeMemberSession(storedMemberId, storedMember);
          setAccessToken(storedToken);
          setMember(storedMember);
          setStatus("authenticated");
          return;
        } catch {
          // 액세스 토큰 만료나 일시적인 회원 조회 실패 모두 리프레시로 복구를 시도한다.
        }
      }

      try {
        const refreshed = await bbangbatApi.refreshToken();
        refreshSucceeded = true;
        recoverableToken = refreshed.accessToken;
        const refreshedMemberId = getMemberIdFromAccessToken(refreshed.accessToken);
        if (!refreshedMemberId) throw new Error("갱신된 토큰에 회원 정보가 없어요.");
        const refreshedMember = await bbangbatApi.getMe(refreshedMemberId, refreshed.accessToken);
        if (!active || isExplicitlyLoggedOut()) return;
        storeAccessToken(refreshed.accessToken);
        storeMemberSession(refreshedMemberId, refreshedMember);
        setAccessToken(refreshed.accessToken);
        setMember(refreshedMember);
        setStatus("authenticated");
      } catch (error) {
        if (!active) return;
        const recoverableMemberId = recoverableToken
          ? getMemberIdFromAccessToken(recoverableToken)
          : null;
        if (
          recoverableToken
          && recoverableMemberId
          && (refreshSucceeded || !isAuthenticationFailure(error))
        ) {
          storeAccessToken(recoverableToken);
          setAccessToken(recoverableToken);
          setMember(cachedMember);
          setStatus("authenticated");
          return;
        }
        clearSession();
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || !memberId || member) return;

    let active = true;
    let retryTimer: number | undefined;

    const scheduleRetry = () => {
      if (!active) return;
      retryTimer = window.setTimeout(() => void recoverMember(), MEMBER_RETRY_MS);
    };

    const recoverMember = async () => {
      try {
        const recoveredMember = await bbangbatApi.getMe(memberId, accessToken);
        if (!active || isExplicitlyLoggedOut()) return;
        storeMemberSession(memberId, recoveredMember);
        setMember(recoveredMember);
      } catch (error) {
        if (!active || isExplicitlyLoggedOut()) return;
        if (!isAuthenticationFailure(error)) {
          scheduleRetry();
          return;
        }
        try {
          const refreshed = await bbangbatApi.refreshToken();
          if (!active || isExplicitlyLoggedOut()) return;
          try {
            await establishSession(refreshed.accessToken);
          } catch {
            scheduleRetry();
          }
        } catch (refreshError) {
          if (!active || isExplicitlyLoggedOut()) return;
          if (isAuthenticationFailure(refreshError)) clearSession();
          else scheduleRetry();
        }
      }
    };

    void recoverMember();
    return () => {
      active = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [accessToken, clearSession, establishSession, member, memberId, status]);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) return;

    let active = true;
    let refreshTimer: number | undefined;
    let refreshing = false;

    const schedule = (delay: number) => {
      if (!active) return;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshSession(), Math.max(0, delay));
    };

    const refreshSession = async () => {
      if (!active || refreshing || isExplicitlyLoggedOut()) return;
      refreshing = true;
      let refreshedToken: string;
      try {
        const refreshed = await bbangbatApi.refreshToken();
        if (!active || isExplicitlyLoggedOut()) return;
        refreshedToken = refreshed.accessToken;
      } catch (error) {
        if (!active || isExplicitlyLoggedOut()) return;
        if (isAuthenticationFailure(error)) {
          clearSession();
        } else {
          schedule(REFRESH_RETRY_MS);
        }
        refreshing = false;
        return;
      }

      try {
        await establishSession(refreshedToken);
      } catch {
        if (active && !isExplicitlyLoggedOut()) schedule(REFRESH_RETRY_MS);
      } finally {
        refreshing = false;
      }
    };

    const expiresAt = getAccessTokenExpiresAt(accessToken);
    schedule(
      member === null
        ? REFRESH_RETRY_MS
        : expiresAt === null
          ? FALLBACK_REFRESH_MS
          : expiresAt - Date.now() - REFRESH_EARLY_MS,
    );

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      const currentExpiry = getAccessTokenExpiresAt(accessToken);
      if (currentExpiry !== null && currentExpiry <= Date.now() + REFRESH_EARLY_MS) {
        void refreshSession();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [accessToken, clearSession, establishSession, member, status]);

  const acceptAccessToken = useCallback(
    async (token: string) => {
      await establishSession(token);
      await queryClient.invalidateQueries();
    },
    [establishSession, queryClient],
  );

  const prepareSocialLogin = useCallback((returnTo = "/") => {
    const safeReturnTo = isSafeInternalPath(returnTo) ? returnTo : "/";
    setExplicitLogout(false);
    sessionStorage.setItem(RETURN_TO_KEY, safeReturnTo);
  }, []);

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
      updateMember,
      acceptAccessToken,
      prepareSocialLogin,
      consumeReturnTo,
      logout,
    }),
    [
      accessToken,
      memberId,
      member,
      status,
      updateMember,
      acceptAccessToken,
      prepareSocialLogin,
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

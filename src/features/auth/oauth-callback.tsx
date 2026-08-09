"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { requestMapLoginModal } from "@/features/auth/login-handoff";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { LoadingState } from "@/shared/ui/states";

export function OAuthCallback() {
  const router = useRouter();
  const { acceptAccessToken, cancelSocialLogin, consumeReturnTo } = useAuth();
  const { notify } = useFeedback();
  const startedRef = useRef(false);

  const returnToMapLogin = useCallback((message?: string) => {
    cancelSocialLogin();
    requestMapLoginModal("/");
    if (message) notify(message, "error");
    router.replace("/");
  }, [cancelSocialLogin, notify, router]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    window.history.replaceState(null, "", url.pathname);

    if (error || !code) {
      queueMicrotask(() => returnToMapLogin());
      return;
    }

    bbangbatApi.exchangeOAuthCode(code)
      .then(async (result) => {
        if (result.type !== "LOGIN" || !result.accessToken) {
          throw new Error("로그인 교환 결과가 올바르지 않아요.");
        }
        await acceptAccessToken(result.accessToken);
        router.replace(consumeReturnTo());
      })
      .catch((exchangeError: unknown) => {
        const message = exchangeError instanceof ApiError
          && exchangeError.status === 401
          && exchangeError.code === "INVALID_TOKEN"
          ? "로그인 유효 시간이 만료됐어요. 다시 로그인해 주세요."
          : "로그인을 완료하지 못했어요. 다시 시도해 주세요.";
        returnToMapLogin(message);
      });
  }, [acceptAccessToken, consumeReturnTo, returnToMapLogin, router]);

  return <LoadingState label="로그인을 마무리하는 중" />;
}

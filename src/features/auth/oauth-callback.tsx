"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { requestMapLoginModal } from "@/features/auth/login-handoff";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { LoadingState } from "@/shared/ui/states";

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

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
    const accessToken = url.searchParams.get("access_token");

    if (!accessToken || !JWT_PATTERN.test(accessToken)) {
      window.history.replaceState(null, "", url.pathname);
      queueMicrotask(() => returnToMapLogin());
      return;
    }

    window.history.replaceState(null, "", url.pathname);
    acceptAccessToken(accessToken)
      .then(() => router.replace(consumeReturnTo()))
      .catch(() => returnToMapLogin("로그인을 완료하지 못했어요. 다시 시도해 주세요."));
  }, [acceptAccessToken, consumeReturnTo, returnToMapLogin, router]);

  return <LoadingState label="로그인을 마무리하는 중" />;
}

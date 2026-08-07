"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { LoadingState } from "@/shared/ui/states";

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function OAuthCallback() {
  const router = useRouter();
  const { acceptAccessToken, consumeReturnTo } = useAuth();
  const { openLogin } = useLoginModal();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const url = new URL(window.location.href);
    const accessToken = url.searchParams.get("access_token");

    if (!accessToken || !JWT_PATTERN.test(accessToken)) {
      queueMicrotask(() => setError("로그인 정보를 확인하지 못했어요."));
      return;
    }

    window.history.replaceState(null, "", url.pathname);
    acceptAccessToken(accessToken)
      .then(() => router.replace(consumeReturnTo()))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "로그인을 마무리하지 못했어요. 다시 시도해 주세요.");
      });
  }, [acceptAccessToken, consumeReturnTo, router]);

  if (error) {
    return (
      <main className="center-page">
        <div className="callback-error">
          <strong>{error}</strong>
          <button type="button" className="button button-primary" onClick={() => openLogin("/")}>다시 로그인</button>
        </div>
      </main>
    );
  }

  return <LoadingState label="로그인을 마무리하는 중" />;
}

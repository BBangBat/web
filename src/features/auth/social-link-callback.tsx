"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import {
  SOCIAL_LINK_MEMBER_KEY,
  SOCIAL_LINK_RETURN_TO,
} from "@/features/auth/social-link-flow";
import {
  applyCurrentSocialProvider,
  resolveCurrentSocialProvider,
} from "@/features/auth/social-account-state";
import type { MemberSocial } from "@/entities/types";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { LoadingState } from "@/shared/ui/states";

type LinkCallbackPayload = {
  code: string | null;
  error: string | null;
};

export function SocialLinkCallback() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, currentSocialProvider, memberId, status } = useAuth();
  const { notify } = useFeedback();
  const callbackRef = useRef<LinkCallbackPayload | null>(null);
  const startedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!callbackRef.current) {
      const url = new URL(window.location.href);
      callbackRef.current = {
        code: url.searchParams.get("code"),
        error: url.searchParams.get("error"),
      };
      window.history.replaceState(null, "", url.pathname);
    }

    const callback = callbackRef.current;
    if (callback.error) {
      const message = callback.error === "already_linked"
        ? "이미 다른 빵밭 계정에 연동된 소셜 계정이에요."
        : "소셜 계정을 연동하지 못했어요. 다시 시도해 주세요.";
      queueMicrotask(() => setErrorMessage(message));
      return;
    }
    if (!callback.code) {
      queueMicrotask(() => setErrorMessage("소셜 연동 정보를 확인하지 못했어요."));
      return;
    }
    if (status === "initializing") return;
    if (status !== "authenticated" || !accessToken || !memberId) {
      queueMicrotask(() => setErrorMessage("로그인 세션이 만료됐어요. 마이페이지에서 다시 연동해 주세요."));
      return;
    }
    if (startedRef.current) return;

    const expectedMemberId = sessionStorage.getItem(SOCIAL_LINK_MEMBER_KEY);
    sessionStorage.removeItem(SOCIAL_LINK_MEMBER_KEY);
    if (expectedMemberId !== memberId) {
      queueMicrotask(() => setErrorMessage("연동을 시작한 계정과 현재 로그인 계정이 달라 연동을 중단했어요."));
      return;
    }

    startedRef.current = true;
    bbangbatApi.exchangeOAuthCode(callback.code)
      .then((result) => {
        if (result.type !== "LINK" || !result.tempToken) {
          throw new Error("소셜 연동 교환 결과가 올바르지 않아요.");
        }
        return bbangbatApi.linkSocial(result.tempToken, accessToken);
      })
      .then((socials) => {
        const queryKey = ["member-socials", memberId];
        const cachedSocials = queryClient.getQueryData<MemberSocial[]>(queryKey);
        const stableCurrentProvider = resolveCurrentSocialProvider(
          cachedSocials ?? socials,
          currentSocialProvider,
        );
        queryClient.setQueryData(
          queryKey,
          applyCurrentSocialProvider(socials, stableCurrentProvider),
        );
        void queryClient.invalidateQueries({ queryKey });
        notify("소셜 계정을 연동했어요.", "success");
        router.replace(SOCIAL_LINK_RETURN_TO);
      })
      .catch((error: unknown) => {
        const message = error instanceof ApiError && error.code === "SOCIAL_ALREADY_LINKED"
          ? "이미 연동된 소셜 계정이에요."
          : error instanceof Error
            ? error.message
            : "소셜 계정을 연동하지 못했어요.";
        setErrorMessage(message);
      });
  }, [accessToken, currentSocialProvider, memberId, notify, queryClient, router, status]);

  if (errorMessage) {
    return (
      <main className="center-page">
        <div className="callback-error">
          <strong>{errorMessage}</strong>
          <button
            type="button"
            className="button button-primary"
            onClick={() => router.replace(SOCIAL_LINK_RETURN_TO)}
          >
            마이페이지로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  return <LoadingState label="소셜 계정을 연동하는 중" />;
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import {
  clearSocialUnlinkRequest,
  readSocialUnlinkRequest,
  SOCIAL_UNLINK_RETURN_TO,
  WITHDRAWAL_REAUTH_RETURN_TO,
} from "@/features/auth/social-unlink-flow";
import type { SocialProvider } from "@/entities/types";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { LoadingState } from "@/shared/ui/states";

const socialProviderLabel: Record<SocialProvider, string> = {
  NAVER: "네이버",
  KAKAO: "카카오",
};

function unlinkErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "CURRENT_SOCIAL_CANNOT_UNLINK") {
      return "현재 로그인 중인 소셜 계정은 연동 해제할 수 없어요.";
    }
    if (error.code === "LAST_SOCIAL_CANNOT_UNLINK") {
      return "마지막으로 연동된 소셜 계정은 해제할 수 없어요.";
    }
  }
  return error instanceof Error ? error.message : "소셜 계정 연동을 해제하지 못했어요.";
}

export function SocialUnlinkCallback() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, memberId, status } = useAuth();
  const { notify } = useFeedback();
  const startedRef = useRef(false);

  const returnToMypage = useCallback((message: string, type: "info" | "error" = "error") => {
    clearSocialUnlinkRequest();
    notify(message, type);
    router.replace(SOCIAL_UNLINK_RETURN_TO);
  }, [notify, router]);

  useEffect(() => {
    if (status === "initializing" || startedRef.current) return;
    startedRef.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    window.history.replaceState(null, "", url.pathname);
    const request = readSocialUnlinkRequest();

    if (error || !code) {
      queueMicrotask(() => returnToMypage("소셜 계정 확인을 취소했어요.", "info"));
      return;
    }
    if (status !== "authenticated" || !accessToken || !memberId) {
      queueMicrotask(() => returnToMypage("로그인 세션이 만료됐어요. 다시 로그인해 주세요."));
      return;
    }
    if (!request || request.memberId !== memberId) {
      queueMicrotask(() => returnToMypage("연동 해제를 시작한 계정과 현재 로그인 계정을 확인하지 못했어요."));
      return;
    }

    bbangbatApi.exchangeOAuthCode(code)
      .then(async (result) => {
        if (result.type !== "UNLINK" || result.provider !== request.provider) {
          throw new Error("소셜 계정 확인 결과가 올바르지 않아요.");
        }
        if (request.action === "withdraw-member") {
          router.replace(WITHDRAWAL_REAUTH_RETURN_TO);
          return;
        }

        await bbangbatApi.unlinkSocial(result.provider, accessToken);
        clearSocialUnlinkRequest();
        await queryClient.invalidateQueries({ queryKey: ["member-socials", memberId] });
        notify(`${socialProviderLabel[result.provider]} 계정 연동을 해제했어요.`, "success");
        router.replace(SOCIAL_UNLINK_RETURN_TO);
      })
      .catch((exchangeError: unknown) => {
        returnToMypage(unlinkErrorMessage(exchangeError));
      });
  }, [accessToken, memberId, notify, queryClient, returnToMypage, router, status]);

  return <LoadingState label="소셜 계정을 확인하는 중" />;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgeGroup, Gender } from "@/entities/types";
import { requestMapLoginModal } from "@/features/auth/login-handoff";
import { SignupForm } from "@/features/auth/signup-form";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { LoadingState } from "@/shared/ui/states";

type SignupExchange = {
  tempToken: string;
  existingAccount: boolean;
  gender: Gender | null;
  ageGroup: AgeGroup | null;
};

export function SignupCallback({ code }: { code: string | null }) {
  const router = useRouter();
  const { notify } = useFeedback();
  const startedRef = useRef(false);
  const [exchange, setExchange] = useState<SignupExchange | null>(null);

  const returnToMapLogin = useCallback((message: string) => {
    requestMapLoginModal("/");
    notify(message, "error");
    router.replace("/");
  }, [notify, router]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);

    if (!code) {
      queueMicrotask(() => returnToMapLogin("가입 정보를 확인하지 못했어요. 다시 로그인해 주세요."));
      return;
    }

    bbangbatApi.exchangeOAuthCode(code)
      .then((result) => {
        if (result.type !== "SIGNUP" || !result.tempToken) {
          throw new Error("회원가입 교환 결과가 올바르지 않아요.");
        }
        setExchange({
          tempToken: result.tempToken,
          existingAccount: result.existingAccount,
          gender: result.gender ?? null,
          ageGroup: result.ageGroup ?? null,
        });
      })
      .catch((exchangeError: unknown) => {
        const message = exchangeError instanceof ApiError
          && exchangeError.status === 401
          && exchangeError.code === "INVALID_TOKEN"
          ? "가입 유효 시간이 만료됐어요. 다시 로그인해 주세요."
          : "가입 정보를 확인하지 못했어요. 다시 로그인해 주세요.";
        returnToMapLogin(message);
      });
  }, [code, returnToMapLogin]);

  if (!exchange) return <LoadingState label="가입 정보를 확인하는 중" />;

  return (
    <SignupForm
      tempToken={exchange.tempToken}
      existingAccount={exchange.existingAccount}
      initialGender={exchange.gender}
      initialAgeGroup={exchange.ageGroup}
    />
  );
}

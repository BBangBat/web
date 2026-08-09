"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, UserRound, X } from "lucide-react";
import { z } from "zod";
import type { AgeGroup } from "@/entities/types";
import { useAuth } from "@/features/auth/auth-context";
import { requestMapLoginModal } from "@/features/auth/login-handoff";
import { PrivacyContent, TermsContent } from "@/features/legal/legal-content";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { useFeedback } from "@/shared/ui/feedback-provider";
import {
  isValidNickname,
  limitTextInput,
  NICKNAME_MAX_LENGTH,
} from "@/shared/lib/text-input";

const nicknameErrorMessage = "닉네임은 한글, 영문, 숫자만 2~10자로 입력해 주세요.";

const signupSchema = z.object({
  nickname: z.string().refine(isValidNickname, { message: nicknameErrorMessage }),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  ageGroup: z.enum(["TEENS", "TWENTIES", "THIRTIES", "FORTIES", "FIFTIES", "SIXTIES_PLUS"]).optional(),
  termsAgreed: z.boolean().refine(Boolean, { message: "서비스 이용약관 동의가 필요해요." }),
  privacyAgreed: z.boolean().refine(Boolean, { message: "개인정보처리방침 동의가 필요해요." }),
});

type SignupFormValues = z.infer<typeof signupSchema>;
type LegalDocument = "privacy" | "terms";

const ageOptions: { value: AgeGroup; label: string }[] = [
  { value: "TEENS", label: "10대" },
  { value: "TWENTIES", label: "20대" },
  { value: "THIRTIES", label: "30대" },
  { value: "FORTIES", label: "40대" },
  { value: "FIFTIES", label: "50대" },
  { value: "SIXTIES_PLUS", label: "60대 이상" },
];

function SignupMapLink() {
  return (
    <Link href="/" className="signup-map-link">
      <ArrowLeft aria-hidden="true" size={20} />
      <span>지도로 돌아가기</span>
    </Link>
  );
}

export function SignupForm({
  tempToken,
  existingAccount,
}: {
  tempToken: string;
  existingAccount: boolean;
}) {
  const router = useRouter();
  const { acceptAccessToken, consumeReturnTo } = useAuth();
  const { notify } = useFeedback();
  const [signupStep, setSignupStep] = useState<"account-check" | "form">("account-check");
  const [debouncedNickname, setDebouncedNickname] = useState("");
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const legalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { nickname: "", termsAgreed: false, privacyAgreed: false },
  });
  const selectedGender = useWatch({ control, name: "gender" });
  const selectedAgeGroup = useWatch({ control, name: "ageGroup" });
  const nickname = useWatch({ control, name: "nickname" }) ?? "";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedNickname(nickname), 350);
    return () => window.clearTimeout(timer);
  }, [nickname]);

  const nicknameQuery = useQuery({
    queryKey: ["nickname-availability", debouncedNickname],
    queryFn: () => bbangbatApi.checkNickname(debouncedNickname),
    enabled: signupStep === "form"
      && debouncedNickname === nickname
      && isValidNickname(debouncedNickname),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const nicknameStatus = !isValidNickname(nickname)
    ? "idle"
    : debouncedNickname !== nickname || nicknameQuery.isFetching
      ? "checking"
      : nicknameQuery.isSuccess
        ? nicknameQuery.data.available ? "available" : "taken"
        : "idle";
  const nicknamePatternInvalid = nickname.length > 0 && !isValidNickname(nickname);

  const signupMutation = useMutation({
    mutationFn: async (values: SignupFormValues) => {
      const result = await bbangbatApi.signup({
        tempToken,
        nickname: values.nickname,
        gender: values.gender,
        ageGroup: values.ageGroup,
        termsAgreed: values.termsAgreed,
        privacyAgreed: values.privacyAgreed,
      });
      await acceptAccessToken(result.accessToken);
    },
    onSuccess: () => {
      notify("빵밭의 빵친구가 되었어요!", "success");
      router.replace(consumeReturnTo());
    },
    onError: (error) => notify(error instanceof Error ? error.message : "가입하지 못했어요.", "error"),
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const result = await bbangbatApi.linkAccount(tempToken);
      await acceptAccessToken(result.accessToken);
    },
    onSuccess: () => {
      notify("기존 계정과 연동했어요.", "success");
      router.replace(consumeReturnTo());
    },
    onError: (error) => notify(error instanceof Error ? error.message : "계정을 연동하지 못했어요.", "error"),
  });

  const closeLegalDocument = useCallback(() => {
    setLegalDocument(null);
    window.requestAnimationFrame(() => legalTriggerRef.current?.focus());
  }, []);

  function openLegalDocument(document: LegalDocument, trigger: HTMLButtonElement) {
    legalTriggerRef.current = trigger;
    setLegalDocument(document);
  }

  useEffect(() => {
    if (!legalDocument) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLegalDocument();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeLegalDocument, legalDocument]);

  if (existingAccount) {
    return (
      <main className="signup-page">
        <section className="account-link-card">
          <p className="eyebrow">WELCOME BACK</p>
          <h1>이미 가입한 이메일이에요.</h1>
          <p>새 소셜 계정을 기존 계정과 연동하시겠어요?</p>
          <div className="account-link-actions">
            <button type="button" className="button button-secondary" disabled={linkMutation.isPending} onClick={() => router.replace("/")}>
              취소
            </button>
            <button type="button" className="button button-primary" disabled={linkMutation.isPending} onClick={() => linkMutation.mutate()}>
              {linkMutation.isPending ? "연동하는 중…" : "기존 계정과 연동하기"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (signupStep === "account-check") {
    return (
      <main className="signup-page">
        <section className="account-link-card account-check-card">
          <p className="eyebrow">CHECK YOUR ACCOUNT</p>
          <h1>다른 소셜 계정으로<br />가입하신 적이 있나요?</h1>
          <p>
            기존 빵밭 계정이 있다면 해당 계정으로 로그인한 뒤<br />
            마이페이지에서 새 소셜 계정을 연동해 주세요.
          </p>
          <div className="account-link-actions account-check-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                requestMapLoginModal("/mypage?tab=profile");
                router.replace("/");
              }}
            >
              기존 계정으로 로그인
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setSignupStep("form")}
            >
              새로 가입하기
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="signup-page">
        <SignupMapLink />
        <form className="signup-form" onSubmit={handleSubmit((values) => signupMutation.mutate(values))}>
          <header>
            <p className="eyebrow">SIGN UP</p>
            <h1>회원가입</h1>
          </header>

        <label className="signup-field signup-nickname-field">
          <span>닉네임 <b className="required-mark" aria-label="필수">*</b></span>
          <div className="field-with-button" data-availability={nicknameStatus}>
            <UserRound aria-hidden="true" size={18} />
            <input
              className="field"
              placeholder="한글, 영문, 숫자 2~10자"
              required
              maxLength={NICKNAME_MAX_LENGTH}
              minLength={2}
              pattern="[가-힣A-Za-z0-9]{2,10}"
              title={nicknameErrorMessage}
              aria-invalid={nicknamePatternInvalid || Boolean(errors.nickname) || nicknameStatus === "taken"}
              {...register("nickname", {
                onChange: (event) => {
                  event.target.value = limitTextInput(String(event.target.value), NICKNAME_MAX_LENGTH);
                },
              })}
            />
            {nicknameStatus === "available" ? <Check aria-label="사용 가능" size={17} /> : null}
          </div>
          {nicknameStatus === "taken" ? <p className="field-error">이미 사용 중인 닉네임이에요.</p> : null}
          {nicknamePatternInvalid ? <p className="field-error">{nicknameErrorMessage}</p> : null}
          {!nicknamePatternInvalid && errors.nickname ? <p className="field-error">{errors.nickname.message}</p> : null}
        </label>

        <fieldset className="signup-field">
          <legend>성별</legend>
          <div className="choice-grid choice-grid-two">
            {([ ["FEMALE", "여성"], ["MALE", "남성"] ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-selected={selectedGender === value}
                aria-pressed={selectedGender === value}
                onClick={() => setValue(
                  "gender",
                  selectedGender === value ? undefined : value,
                  { shouldDirty: true, shouldValidate: true },
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="signup-field">
          <legend>연령대</legend>
          <div className="choice-grid choice-grid-age">
            {ageOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                data-selected={selectedAgeGroup === option.value}
                aria-pressed={selectedAgeGroup === option.value}
                onClick={() => setValue(
                  "ageGroup",
                  selectedAgeGroup === option.value ? undefined : option.value,
                  { shouldDirty: true, shouldValidate: true },
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="agreements">
          <div className="agreement-row">
            <label>
              <input type="checkbox" {...register("privacyAgreed")} />
              <span className="agreement-check"><Check aria-hidden="true" size={13} /></span>
              <b>[필수]</b> 개인정보처리방침 동의
            </label>
            <button
              type="button"
              className="agreement-document-button"
              onClick={(event) => openLegalDocument("privacy", event.currentTarget)}
              aria-label="개인정보처리방침 보기"
            >
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
          <div className="agreement-row">
            <label>
              <input type="checkbox" {...register("termsAgreed")} />
              <span className="agreement-check"><Check aria-hidden="true" size={13} /></span>
              <b>[필수]</b> 서비스 이용약관 동의
            </label>
            <button
              type="button"
              className="agreement-document-button"
              onClick={(event) => openLegalDocument("terms", event.currentTarget)}
              aria-label="서비스 이용약관 보기"
            >
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
          {errors.termsAgreed || errors.privacyAgreed ? <p className="field-error">필수 약관에 모두 동의해 주세요.</p> : null}
        </div>

        <button type="submit" className="button button-primary submit-button" disabled={signupMutation.isPending || nicknameStatus === "checking" || nicknameStatus === "taken"}>
          {signupMutation.isPending ? "가입하는 중…" : "빵밭 시작하기"}
        </button>
        </form>
      </main>

      {legalDocument ? (
        <div
          className="signup-legal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLegalDocument();
          }}
        >
          <section
            className="signup-legal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${legalDocument}-document-title`}
          >
            <button
              type="button"
              className="signup-legal-close"
              onClick={closeLegalDocument}
              aria-label="동의서 닫기"
              autoFocus
            >
              <X aria-hidden="true" size={20} />
            </button>
            <div className="signup-legal-scroll">
              {legalDocument === "privacy" ? <PrivacyContent /> : <TermsContent />}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

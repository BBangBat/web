"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronRight, CircleCheck, UserRound } from "lucide-react";
import { z } from "zod";
import type { AgeGroup, Gender } from "@/entities/types";
import { useAuth } from "@/features/auth/auth-context";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { Brand } from "@/shared/ui/brand";
import { limitTextInput } from "@/shared/lib/text-input";

const signupSchema = z.object({
  nickname: z.string().trim().min(2, "닉네임은 2자 이상이어야 해요.").max(20),
  gender: z.enum(["MALE", "FEMALE"], { message: "성별을 선택해 주세요." }),
  ageGroup: z.enum(["TEENS", "TWENTIES", "THIRTIES", "FORTIES", "FIFTIES", "SIXTIES_PLUS"], {
    message: "연령대를 선택해 주세요.",
  }),
  termsAgreed: z.boolean().refine(Boolean, { message: "서비스 이용약관 동의가 필요해요." }),
  privacyAgreed: z.boolean().refine(Boolean, { message: "개인정보처리방침 동의가 필요해요." }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const ageOptions: { value: AgeGroup; label: string }[] = [
  { value: "TEENS", label: "10대" },
  { value: "TWENTIES", label: "20대" },
  { value: "THIRTIES", label: "30대" },
  { value: "FORTIES", label: "40대" },
  { value: "FIFTIES", label: "50대" },
  { value: "SIXTIES_PLUS", label: "60대 이상" },
];

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
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { nickname: "", termsAgreed: false, privacyAgreed: false },
  });

  const signupMutation = useMutation({
    mutationFn: async (values: SignupFormValues) => {
      const result = await bbangbatApi.signup({
        tempToken,
        nickname: values.nickname.trim(),
        gender: values.gender as Gender,
        ageGroup: values.ageGroup as AgeGroup,
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

  async function checkNickname() {
    const nickname = getValues("nickname").trim();
    if (nickname.length < 2 || nickname.length > 20) return;
    setNicknameStatus("checking");
    try {
      const { available } = await bbangbatApi.checkNickname(nickname);
      setNicknameStatus(available ? "available" : "taken");
    } catch {
      setNicknameStatus("idle");
    }
  }

  if (existingAccount) {
    return (
      <main className="signup-page">
        <section className="account-link-card">
          <CircleCheck aria-hidden="true" size={42} />
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

  return (
    <main className="signup-page">
      <div className="signup-header"><Brand /><span>가입 정보 입력</span></div>
      <form className="signup-form" onSubmit={handleSubmit((values) => signupMutation.mutate(values))}>
        <header>
          <p className="eyebrow">ONE MORE STEP</p>
          <h1>어떤 빵친구로<br />불러드릴까요?</h1>
          <p>맞춤 정보를 위해 몇 가지만 알려주세요.</p>
        </header>

        <label className="signup-field">
          <span>닉네임</span>
          <div className="field-with-button">
            <UserRound aria-hidden="true" size={18} />
            <input
              className="field"
              placeholder="2~20자"
              maxLength={20}
              {...register("nickname", {
                onBlur: checkNickname,
                onChange: (event) => {
                  event.target.value = limitTextInput(String(event.target.value), 20);
                  setNicknameStatus("idle");
                },
              })}
            />
            {nicknameStatus === "available" ? <Check aria-label="사용 가능" size={17} /> : null}
          </div>
          {nicknameStatus === "checking" ? <small>사용할 수 있는지 확인 중…</small> : null}
          {nicknameStatus === "available" ? <small className="field-success">사용할 수 있는 닉네임이에요.</small> : null}
          {nicknameStatus === "taken" ? <p className="field-error">이미 사용 중인 닉네임이에요.</p> : null}
          {errors.nickname ? <p className="field-error">{errors.nickname.message}</p> : null}
        </label>

        <fieldset className="signup-field">
          <legend>성별</legend>
          <div className="choice-grid choice-grid-two">
            {([ ["FEMALE", "여성"], ["MALE", "남성"] ] as const).map(([value, label]) => (
              <label key={value}><input type="radio" value={value} {...register("gender")} /><span>{label}</span></label>
            ))}
          </div>
          {errors.gender ? <p className="field-error">{errors.gender.message}</p> : null}
        </fieldset>

        <fieldset className="signup-field">
          <legend>연령대</legend>
          <div className="choice-grid choice-grid-age">
            {ageOptions.map((option) => (
              <label key={option.value}><input type="radio" value={option.value} {...register("ageGroup")} /><span>{option.label}</span></label>
            ))}
          </div>
          {errors.ageGroup ? <p className="field-error">{errors.ageGroup.message}</p> : null}
        </fieldset>

        <div className="agreements">
          <label><input type="checkbox" {...register("termsAgreed")} /><span><Check aria-hidden="true" size={13} /></span><b>[필수]</b> 서비스 이용약관 동의 <ChevronRight aria-hidden="true" size={16} /></label>
          <label><input type="checkbox" {...register("privacyAgreed")} /><span><Check aria-hidden="true" size={13} /></span><b>[필수]</b> 개인정보처리방침 동의 <ChevronRight aria-hidden="true" size={16} /></label>
          {errors.termsAgreed || errors.privacyAgreed ? <p className="field-error">필수 약관에 모두 동의해 주세요.</p> : null}
        </div>

        <button type="submit" className="button button-primary submit-button" disabled={signupMutation.isPending || nicknameStatus === "taken"}>
          {signupMutation.isPending ? "가입하는 중…" : "빵밭 시작하기"}
        </button>
      </form>
    </main>
  );
}

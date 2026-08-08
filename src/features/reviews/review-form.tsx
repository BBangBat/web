"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, Star, X } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { featureFlags } from "@/shared/config/features";
import { limitTextInput } from "@/shared/lib/text-input";
import { useFeedback } from "@/shared/ui/feedback-provider";

const reviewSchema = z.object({
  rating: z.number().min(1, "별점을 선택해 주세요.").max(5),
  menus: z.string().trim().min(1, "구매한 메뉴를 입력해 주세요."),
  content: z
    .string()
    .trim()
    .min(10, "후기는 10자 이상 입력해 주세요.")
    .max(500, "후기는 500자까지 입력할 수 있어요."),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;
const supportedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function ReviewForm({ storeId }: { storeId: number }) {
  const router = useRouter();
  const { accessToken, memberId, status } = useAuth();
  const { openLogin } = useLoginModal();
  const { notify } = useFeedback();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const storeQuery = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => bbangbatApi.getStore(storeId),
  });
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, menus: "", content: "" },
  });
  const rating = useWatch({ control, name: "rating" });
  const content = useWatch({ control, name: "content" });

  useEffect(() => {
    if (!featureFlags.reviewWriting) {
      notify("빵명록 작성 기능은 준비 중이에요.", "info");
      router.replace(`/?storeId=${storeId}`);
      return;
    }
    if (status === "anonymous") {
      openLogin(`/reviews/new?storeId=${storeId}`);
      router.replace(`/?storeId=${storeId}`);
    }
  }, [notify, openLogin, router, status, storeId]);

  const createMutation = useMutation({
    mutationFn: async (values: ReviewFormValues) => {
      if (!accessToken || !memberId) throw new Error("로그인이 필요해요.");
      const imageKeys = await bbangbatApi.uploadReviewImages(files, accessToken);
      return bbangbatApi.createReview(
        {
          storeId,
          rating: values.rating,
          menus: values.menus.split(",").map((menu) => menu.trim()).filter(Boolean),
          content: values.content.trim(),
          imageKeys,
        },
        accessToken,
      );
    },
    onSuccess: () => {
      notify("빵명록을 기록했어요.", "success");
      router.replace(`/?storeId=${storeId}`);
    },
    onError: (error) => notify(error instanceof Error ? error.message : "기록하지 못했어요.", "error"),
  });

  function selectImages(fileList: FileList | null) {
    const nextFiles = Array.from(fileList ?? []).slice(0, 5);
    const invalid = nextFiles.find((file) => !supportedImageTypes.includes(file.type));
    if (invalid) {
      notify("JPG, PNG, WebP, HEIC 이미지만 올릴 수 있어요.", "error");
      return;
    }
    previews.forEach((preview) => URL.revokeObjectURL(preview));
    setFiles(nextFiles);
    setPreviews(nextFiles.map((file) => URL.createObjectURL(file)));
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(previews[index] || "");
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setPreviews((current) => current.filter((_, previewIndex) => previewIndex !== index));
  }

  if (!featureFlags.reviewWriting || status === "anonymous") return null;

  return (
    <main className="form-page">
      <div className="form-topbar">
        <button type="button" onClick={() => router.back()} aria-label="이전 페이지">
          <ArrowLeft aria-hidden="true" size={21} />
        </button>
        <div><span>빵명록</span><strong>{storeQuery.data?.name ?? "빵집"}</strong></div>
      </div>

      <form className="review-form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
        <header>
          <p className="eyebrow">BREAD NOTE</p>
          <h1>빵명록 작성</h1>
        </header>

        <fieldset className="form-section">
          <legend>별점 <b className="required-mark" aria-label="필수">*</b></legend>
          <div className="rating-input" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                onClick={() => setValue("rating", value, { shouldValidate: true })}
              >
                <Star aria-hidden="true" size={30} fill={rating >= value ? "currentColor" : "none"} />
              </button>
            ))}
            <span>{rating ? `${rating}.0` : "별점을 선택해 주세요"}</span>
          </div>
          {errors.rating ? <p className="field-error">{errors.rating.message}</p> : null}
        </fieldset>

        <label className="form-section">
          <span className="form-label">구매한 메뉴 <b className="required-mark" aria-label="필수">*</b></span>
          <input
            className="field"
            placeholder="예: 소금빵, 명란바게트"
            maxLength={100}
            {...register("menus", {
              onChange: (event) => {
                event.target.value = limitTextInput(String(event.target.value), 100);
              },
            })}
          />
          <small>여러 개라면 쉼표로 구분해 주세요.</small>
          {errors.menus ? <p className="field-error">{errors.menus.message}</p> : null}
        </label>

        <label className="form-section">
          <span className="form-label">빵명록 <b className="required-mark" aria-label="필수">*</b></span>
          <textarea
            className="field review-textarea"
            placeholder="맛, 대기 시간, 다시 사고 싶은 메뉴를 자유롭게 적어주세요."
            maxLength={500}
            {...register("content", {
              onChange: (event) => {
                event.target.value = limitTextInput(String(event.target.value), 500);
              },
            })}
          />
          <small className="character-count">{content.length}/500</small>
          {errors.content ? <p className="field-error">{errors.content.message}</p> : null}
        </label>

        <div className="form-section">
          <span className="form-label">사진 <em>선택</em></span>
          <div className="image-picker">
            <label>
              <Camera aria-hidden="true" size={23} />
              <span>{files.length}/5</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple onChange={(event) => selectImages(event.target.files)} />
            </label>
            {previews.map((preview, index) => (
              <div key={preview} style={{ backgroundImage: `url(${preview})` }}>
                <button type="button" onClick={() => removeImage(index)} aria-label={`${index + 1}번째 사진 삭제`}>
                  <X aria-hidden="true" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="button button-primary submit-button" disabled={createMutation.isPending || status === "initializing"}>
          {createMutation.isPending ? "사진과 기록을 저장하는 중…" : "빵명록 저장하기"}
        </button>
      </form>
    </main>
  );
}

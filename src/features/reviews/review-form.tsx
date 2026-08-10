"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import type { Review } from "@/entities/types";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { reviewSchema, type ReviewFormValues } from "@/features/reviews/review-form-validation";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { featureFlags } from "@/shared/config/features";
import { moveReviewImage } from "@/shared/lib/review-images";
import { mergeReviewMenus } from "@/shared/lib/review-menus";
import { limitTextInput, textInputLength } from "@/shared/lib/text-input";
import { useFeedback } from "@/shared/ui/feedback-provider";

const supportedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function ReviewForm({ storeId }: { storeId: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, memberId, status } = useAuth();
  const { openLogin } = useLoginModal();
  const { notify } = useFeedback();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [menuDraft, setMenuDraft] = useState("");
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const storeQuery = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => bbangbatApi.getStore(storeId),
  });
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isValid },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    mode: "onChange",
    defaultValues: { rating: 0, menus: [], content: "" },
  });
  const rating = useWatch({ control, name: "rating" });
  const menus = useWatch({ control, name: "menus" });
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

  useEffect(() => {
    if (!expandedPreview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => previewCloseRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previewTriggerRef.current?.focus();
    };
  }, [expandedPreview]);

  const createMutation = useMutation({
    mutationFn: async (values: ReviewFormValues) => {
      if (!accessToken || !memberId) throw new Error("로그인이 필요해요.");
      const imageKeys = await bbangbatApi.uploadReviewImages(files, accessToken);
      return bbangbatApi.createReview(
        {
          storeId,
          rating: values.rating,
          menus: values.menus,
          content: values.content.trim(),
          imageKeys,
        },
        accessToken,
      );
    },
    onSuccess: (review) => {
      queryClient.setQueryData<Review[]>(["reviews", storeId], (current = []) => [
        review,
        ...current.filter((item) => item.id !== review.id),
      ]);
      notify("빵명록을 기록했어요.", "success");
      router.replace(`/?storeId=${storeId}`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reviews", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["my-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["member-stats"] }),
      ]);
    },
    onError: (error) => notify(error instanceof Error ? error.message : "기록하지 못했어요.", "error"),
  });

  function selectImages(fileList: FileList | null) {
    const selectedFiles = Array.from(fileList ?? []);
    const invalid = selectedFiles.find((file) => !supportedImageTypes.includes(file.type));
    if (invalid) {
      notify("JPG, PNG, WebP, HEIC 이미지만 올릴 수 있어요.", "error");
      return;
    }
    const availableSlots = Math.max(0, 5 - files.length);
    const nextFiles = selectedFiles.slice(0, availableSlots);
    if (nextFiles.length === 0) return;
    setFiles((current) => [...current, ...nextFiles]);
    setPreviews((current) => [
      ...current,
      ...nextFiles.map((file) => URL.createObjectURL(file)),
    ]);
  }

  function moveImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    setFiles((current) => moveReviewImage(current, index, nextIndex));
    setPreviews((current) => moveReviewImage(current, index, nextIndex));
  }

  function addMenus(candidates: string[]) {
    const nextMenus = mergeReviewMenus(menus, candidates);
    setValue("menus", nextMenus, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function commitMenuDraft() {
    if (!menuDraft.trim()) return;
    addMenus([menuDraft]);
    setMenuDraft("");
  }

  function removeMenu(menuToRemove: string) {
    setValue("menus", menus.filter((menu) => menu !== menuToRemove), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function openImagePreview(preview: string, trigger: HTMLButtonElement) {
    previewTriggerRef.current = trigger;
    setExpandedPreview(preview);
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
        <div>
          <strong>{storeQuery.data?.name ?? "빵집"}</strong>
          <span>{storeQuery.data?.address ?? "가게 정보를 불러오는 중"}</span>
        </div>
      </div>

      <form className="review-form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
        <header>
          <p className="eyebrow">BREAD NOTE</p>
          <h1>빵명록 작성</h1>
        </header>

        <div className="form-section review-photo-section">
          <div className="review-photo-heading">
            <span className="form-label">사진 <em>선택</em></span>
            <span>{files.length}/5</span>
          </div>
          <div className="image-picker">
            {Array.from({ length: 5 }, (_, index) => {
              const preview = previews[index];
              if (preview) {
                return (
                  <div key={preview} className="image-picker-item">
                    <div className="image-picker-photo" style={{ backgroundImage: `url(${preview})` }}>
                      <button
                        type="button"
                        className="image-picker-preview"
                        aria-label={`${index + 1}번째 사진 크게 보기`}
                        onClick={(event) => openImagePreview(preview, event.currentTarget)}
                      />
                      <button type="button" className="image-picker-remove" onClick={() => removeImage(index)} aria-label={`${index + 1}번째 사진 삭제`}>
                        <X aria-hidden="true" size={14} />
                      </button>
                    </div>
                    <div className="image-picker-order" aria-label={`${index + 1}번째 사진 순서 변경`}>
                      <button type="button" disabled={index === 0} onClick={() => moveImage(index, -1)} aria-label={`${index + 1}번째 사진을 왼쪽으로 이동`}>
                        <ChevronLeft aria-hidden="true" size={14} />
                      </button>
                      <span>{index + 1}</span>
                      <button type="button" disabled={index === previews.length - 1} onClick={() => moveImage(index, 1)} aria-label={`${index + 1}번째 사진을 오른쪽으로 이동`}>
                        <ChevronRight aria-hidden="true" size={14} />
                      </button>
                    </div>
                  </div>
                );
              }
              if (index === previews.length) {
                return (
                  <label key={`upload-${index}`}>
                    <Camera aria-hidden="true" size={21} />
                    <span>추가</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      multiple
                      onChange={(event) => {
                        selectImages(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                );
              }
              return <div key={`empty-${index}`} className="image-picker-empty" aria-hidden="true" />;
            })}
          </div>
        </div>

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
            {rating ? <span>{rating}.0</span> : null}
          </div>
          {errors.rating ? <p className="field-error">{errors.rating.message}</p> : null}
        </fieldset>

        <div className="form-section">
          <span className="form-label">구매한 메뉴 <b className="required-mark" aria-label="필수">*</b></span>
          <div className="review-menu-input-row">
            <input
              className="field"
              aria-label="구매한 메뉴 입력"
              placeholder="메뉴 이름"
              maxLength={100}
              value={menuDraft}
              onChange={(event) => {
                const nextDraft = limitTextInput(event.currentTarget.value, 100);
                if (!nextDraft.includes(",")) {
                  setMenuDraft(nextDraft);
                  return;
                }
                const parts = nextDraft.split(",");
                setMenuDraft(parts.pop() ?? "");
                addMenus(parts);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitMenuDraft();
                }
              }}
            />
            <button type="button" disabled={!menuDraft.trim()} onClick={commitMenuDraft}>추가</button>
          </div>
          {menus.length > 0 ? (
            <div className="review-menu-tags" aria-label="등록한 구매 메뉴">
              {menus.map((menu) => (
                <span key={menu}>
                  {menu}
                  <button type="button" onClick={() => removeMenu(menu)} aria-label={`${menu} 삭제`}>
                    <X aria-hidden="true" size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {errors.menus ? <p className="field-error">{errors.menus.message}</p> : null}
        </div>

        <div className="form-section">
          <span className="form-label">상세 후기 <b className="required-mark" aria-label="필수">*</b></span>
          <textarea
            className="field review-textarea"
            placeholder="상세한 후기를 10자 이상 적어주세요"
            maxLength={500}
            {...register("content")}
            value={content}
            onChange={(event) => {
              setValue("content", limitTextInput(event.currentTarget.value, 500), {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
          <div className="review-content-meta">
            {errors.content ? <p className="field-error">{errors.content.message}</p> : null}
            <small className="character-count">{textInputLength(content)}/500</small>
          </div>
        </div>

        <button
          type="submit"
          className="button button-primary submit-button"
          disabled={!isValid || createMutation.isPending || status === "initializing"}
        >
          {createMutation.isPending ? "사진과 기록을 저장하는 중…" : "빵명록 등록하기"}
        </button>
      </form>

      {expandedPreview ? (
        <div
          className="review-image-preview-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setExpandedPreview(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              previewCloseRef.current?.focus();
            }
          }}
        >
          <section role="dialog" aria-modal="true" aria-label="빵명록 사진 크게 보기">
            <button ref={previewCloseRef} type="button" onClick={() => setExpandedPreview(null)} aria-label="사진 닫기">
              <X aria-hidden="true" size={21} />
            </button>
            <div style={{ backgroundImage: `url(${expandedPreview})` }} role="img" aria-label="선택한 빵명록 사진" />
          </section>
        </div>
      ) : null}
    </main>
  );
}

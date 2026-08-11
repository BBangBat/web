"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageCircleMore,
  NotebookText,
  Pencil,
  Settings,
  Star,
  UserRound,
  X,
} from "lucide-react";
import type { AgeGroup, Gender, MyReview, SocialProvider, Store } from "@/entities/types";
import { useAuth } from "@/features/auth/auth-context";
import { SOCIAL_LINK_MEMBER_KEY } from "@/features/auth/social-link-flow";
import {
  clearSocialUnlinkRequest,
  readSocialUnlinkRequest,
  storeSocialUnlinkRequest,
} from "@/features/auth/social-unlink-flow";
import {
  canUnlinkSocial,
  resolveCurrentSocialProvider,
} from "@/features/auth/social-account-state";
import {
  optimisticallySetFavorite,
  rollbackFavoriteCache,
} from "@/features/favorites/favorite-cache";
import { useLoginModal } from "@/features/auth/login-modal";
import { MemberAvatar } from "@/features/members/member-avatar";
import { StoreCard } from "@/features/stores/store-card";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { featureFlags } from "@/shared/config/features";
import { useNicknameAvailability } from "@/shared/hooks/use-nickname-availability";
import {
  AGE_GROUP_LABEL,
  AGE_GROUP_OPTIONS,
  GENDER_LABEL,
  GENDER_OPTIONS,
} from "@/shared/lib/member-demographics";
import { compactReviewDate } from "@/shared/lib/format";
import {
  isValidName,
  isValidNickname,
  limitTextInput,
  NAME_MAX_LENGTH,
  NICKNAME_ERROR_MESSAGE,
  NICKNAME_MAX_LENGTH,
} from "@/shared/lib/text-input";
import { reviewMapHref } from "@/shared/lib/review-navigation";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { LoadingState } from "@/shared/ui/states";

export type MypageTab = "overview" | "reviews" | "favorites" | "profile";

const activityNavigation = [
  { tab: "overview", label: "전체보기", href: "/mypage", Icon: LayoutDashboard },
  { tab: "reviews", label: "내 빵명록", href: "/mypage?tab=reviews", Icon: NotebookText },
  { tab: "favorites", label: "나만의 빵지도", href: "/mypage?tab=favorites", Icon: Heart },
] as const;

const mypageTabTitles: Record<MypageTab, string> = {
  overview: "전체보기",
  reviews: "내 빵명록",
  favorites: "나만의 빵지도",
  profile: "계정 정보",
};

const supportedProfileImageTypes = ["image/jpeg", "image/png", "image/webp"];
const socialProviders = ["KAKAO", "NAVER"] as const satisfies readonly SocialProvider[];
const socialProviderCopy = {
  KAKAO: { label: "카카오", symbol: "K", value: "kakao" },
  NAVER: { label: "네이버", symbol: "N", value: "naver" },
} as const;

function MypageMapLink() {
  return (
    <Link href="/" className="mypage-map-link">
      <ArrowLeft aria-hidden="true" size={21} />
      <span>지도로 돌아가기</span>
    </Link>
  );
}

function MypageReviewStars({ rating }: { rating: number }) {
  return (
    <span className="mypage-review-stars" aria-label={`별점 ${rating}점`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          size={15}
          data-filled={rating >= value}
          fill={rating >= value ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function MypageReviewPhotos({
  imageUrls,
  compact = false,
}: {
  imageUrls: string[];
  compact?: boolean;
}) {
  if (imageUrls.length === 0) return null;
  return (
    <div className="mypage-review-photos" data-compact={compact} aria-label="작성 사진 목록">
      {imageUrls.map((imageUrl, index) => (
        <div
          key={`${imageUrl}-${index}`}
          style={{ backgroundImage: `url(${imageUrl})` }}
          role="img"
          aria-label={`작성 사진 ${index + 1}`}
        />
      ))}
    </div>
  );
}

function MypageReviewCardContent({
  review,
  compact = false,
}: {
  review: MyReview;
  compact?: boolean;
}) {
  return (
    <>
      <div className="mypage-review-card-heading">
        <strong>{review.storeName}</strong>
      </div>
      <div className="mypage-review-card-rating">
        <MypageReviewStars rating={review.rating} />
        <time dateTime={review.createdAt ?? undefined}>{compactReviewDate(review.createdAt)}</time>
      </div>
      <p className="mypage-review-card-content">{review.content}</p>
      {review.menus.length > 0 ? (
        <div className="mypage-review-menu-list" aria-label="구매 메뉴">
          {review.menus.map((menu) => <span key={menu}>{menu}</span>)}
        </div>
      ) : null}
      <MypageReviewPhotos imageUrls={review.imageUrls} compact={compact} />
    </>
  );
}

export function MypageScreen({ initialTab }: { initialTab: MypageTab }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    accessToken,
    memberId,
    member,
    currentSocialProvider,
    status,
    updateMember,
    logout,
  } = useAuth();
  const { openLogin } = useLoginModal();
  const { notify } = useFeedback();
  const [profileModal, setProfileModal] = useState<"profile" | "avatar-preview" | "demographics" | "withdraw" | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [profileImageDraft, setProfileImageDraft] = useState<File | null>(null);
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<string | null>(null);
  const [genderDraft, setGenderDraft] = useState<Gender | null>(null);
  const [ageGroupDraft, setAgeGroupDraft] = useState<AgeGroup | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [reviewToDelete, setReviewToDelete] = useState<MyReview | null>(null);
  const [withdrawalPending, setWithdrawalPending] = useState(false);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const signingOutRef = useRef(false);
  const withdrawalPendingRef = useRef(false);
  const withdrawalResumeRef = useRef(false);
  const reviewDeleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const {
    patternInvalid: nicknamePatternInvalid,
    status: nicknameStatus,
  } = useNicknameAvailability({
    nickname: nicknameDraft,
    currentNickname: member?.nickname,
    enabled: profileModal === "profile",
  });
  const statsQuery = useQuery({
    queryKey: ["member-stats", memberId],
    queryFn: () => bbangbatApi.getMemberStats(accessToken!),
    enabled: Boolean(accessToken && memberId),
  });
  const reviewsQuery = useQuery({
    queryKey: ["my-reviews", memberId],
    queryFn: () => bbangbatApi.getMyReviews(accessToken!),
    enabled: Boolean(accessToken && memberId) && (initialTab === "overview" || initialTab === "reviews"),
  });
  const favoriteIdsQuery = useQuery({
    queryKey: ["favorites", memberId],
    queryFn: () => bbangbatApi.getFavorites(accessToken!),
    enabled: Boolean(accessToken && memberId) && (initialTab === "overview" || initialTab === "favorites"),
  });
  const requestedFavoriteIds = initialTab === "overview"
    ? (favoriteIdsQuery.data ?? []).slice(0, 5)
    : (favoriteIdsQuery.data ?? []);
  const favoriteStoresQuery = useQuery({
    queryKey: ["favorite-stores", memberId, requestedFavoriteIds],
    queryFn: () => bbangbatApi.getStoresBulk(requestedFavoriteIds),
    enabled: favoriteIdsQuery.isSuccess,
  });
  const favoriteCongestionsQuery = useQuery({
    queryKey: ["congestions", requestedFavoriteIds],
    queryFn: () => bbangbatApi.getCongestions(requestedFavoriteIds),
    enabled: requestedFavoriteIds.length > 0,
    refetchInterval: 60_000,
  });
  const favoriteCongestionByStore = useMemo(
    () => new Map((favoriteCongestionsQuery.data ?? []).map((item) => [item.storeId, item])),
    [favoriteCongestionsQuery.data],
  );
  const socialsQuery = useQuery({
    queryKey: ["member-socials", memberId],
    queryFn: () => bbangbatApi.getMySocials(accessToken!),
    enabled: Boolean(accessToken && memberId) && initialTab === "profile",
  });
  const resolvedCurrentSocialProvider = resolveCurrentSocialProvider(
    socialsQuery.data,
    currentSocialProvider,
  );
  const withdrawalSocialProvider = resolvedCurrentSocialProvider
    ?? socialsQuery.data?.[0]?.provider
    ?? null;
  const deleteMutation = useMutation({
    mutationFn: (reviewId: number) => bbangbatApi.deleteReview(reviewId, accessToken!),
    onSuccess: async () => {
      setReviewToDelete(null);
      window.requestAnimationFrame(() => reviewDeleteTriggerRef.current?.focus());
      notify("빵명록을 삭제했어요.", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["member-stats"] }),
      ]);
    },
    onError: (error) => notify(error instanceof Error ? error.message : "삭제하지 못했어요.", "error"),
  });

  const favoriteMutation = useMutation({
    mutationFn: (store: Store) => bbangbatApi.removeFavorite(store.id, accessToken!),
    onMutate: (store) => optimisticallySetFavorite(
      queryClient,
      memberId!,
      store,
      false,
      favoriteStoresQuery.data,
    ),
    onSuccess: () => notify("나만의 빵지도에서 삭제했어요.", "success"),
    onError: (error, _store, snapshot) => {
      rollbackFavoriteCache(queryClient, memberId!, snapshot);
      notify(
        error instanceof Error ? error.message : "즐겨찾기를 삭제하지 못했어요.",
        "error",
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-stores"] }),
        queryClient.invalidateQueries({ queryKey: ["member-stats"] }),
      ]);
    },
  });

  const socialUnlinkMutation = useMutation({
    mutationFn: (provider: SocialProvider) => bbangbatApi.unlinkSocial(provider, accessToken!),
    onSuccess: async (_result, provider) => {
      notify(`${socialProviderCopy[provider].label} 계정 연동을 해제했어요.`, "success");
      await queryClient.invalidateQueries({ queryKey: ["member-socials", memberId] });
    },
    onError: (error, provider) => {
      if (error instanceof ApiError && error.code === "SOCIAL_REAUTH_REQUIRED") {
        startSocialUnlinkReauthentication(provider);
        return;
      }
      const message = error instanceof ApiError && error.code === "CURRENT_SOCIAL_CANNOT_UNLINK"
        ? "현재 로그인 중인 소셜 계정은 연동 해제할 수 없어요."
        : error instanceof ApiError && error.code === "LAST_SOCIAL_CANNOT_UNLINK"
          ? "마지막으로 연동된 소셜 계정은 해제할 수 없어요."
          : error instanceof Error
            ? error.message
            : "소셜 계정 연동을 해제하지 못했어요.";
      notify(message, "error");
    },
  });

  const closeProfileModal = useCallback(() => {
    if (withdrawalPendingRef.current) return;
    setProfileModal(null);
    setProfileImageDraft(null);
    setProfileImagePreviewUrl(null);
    window.requestAnimationFrame(() => modalTriggerRef.current?.focus());
  }, []);

  const requestWithdrawalReauthentication = useCallback(() => {
    if (!memberId || !withdrawalSocialProvider) {
      notify("현재 로그인한 소셜 계정을 확인하고 있어요. 잠시 후 다시 시도해 주세요.", "info");
      return;
    }
    storeSocialUnlinkRequest({
      action: "withdraw-member",
      memberId,
      provider: withdrawalSocialProvider,
    });
    setProfileModal(null);
    window.location.assign(
      bbangbatApi.socialUnlinkUrl(
        socialProviderCopy[withdrawalSocialProvider].value,
        window.location.origin,
      ),
    );
  }, [memberId, notify, withdrawalSocialProvider]);

  const completeWithdrawal = useCallback(async () => {
    if (!accessToken || withdrawalPendingRef.current) return;
    withdrawalPendingRef.current = true;
    setProfileModal("withdraw");
    setWithdrawalPending(true);
    try {
      await bbangbatApi.withdraw(accessToken);
      signingOutRef.current = true;
      setProfileModal(null);
      await logout();
      notify("회원 탈퇴가 완료됐어요.", "success");
      router.replace("/");
    } catch (error) {
      if (error instanceof ApiError && error.code === "SOCIAL_REAUTH_REQUIRED") {
        notify("현재 계정에 연결된 소셜 계정으로 다시 인증해 주세요.", "info");
        requestWithdrawalReauthentication();
        return;
      }
      notify(
        error instanceof Error ? error.message : "회원 탈퇴를 처리하지 못했어요.",
        "error",
      );
    } finally {
      withdrawalPendingRef.current = false;
      setWithdrawalPending(false);
    }
  }, [accessToken, logout, notify, requestWithdrawalReauthentication, router]);

  const profileMutation = useMutation({
    mutationFn: async ({ nickname, image }: { nickname?: string; image: File | null }) => {
      const profileImageKey = image
        ? await bbangbatApi.uploadProfileImage(image, accessToken!)
        : undefined;
      return bbangbatApi.updateProfile({ nickname, profileImageKey }, accessToken!);
    },
    onSuccess: (nextMember) => {
      updateMember(nextMember);
      closeProfileModal();
      notify("프로필을 수정했어요.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "프로필을 수정하지 못했어요.", "error"),
  });

  const nameMutation = useMutation({
    mutationFn: (name: string) => bbangbatApi.updateProfile({ name }, accessToken!),
    onSuccess: (nextMember) => {
      updateMember(nextMember);
      setEditingName(false);
      notify("이름을 수정했어요.", "success");
    },
    onError: (error) => notify(
      error instanceof Error ? error.message : "이름을 수정하지 못했어요.",
      "error",
    ),
  });

  const demographicsMutation = useMutation({
    mutationFn: ({ gender, ageGroup }: { gender?: Gender; ageGroup?: AgeGroup }) =>
      bbangbatApi.updateProfile({ gender, ageGroup }, accessToken!),
    onSuccess: (nextMember) => {
      updateMember(nextMember);
      closeProfileModal();
      notify("성별과 연령대를 수정했어요.", "success");
    },
    onError: (error) => notify(
      error instanceof Error ? error.message : "성별과 연령대를 수정하지 못했어요.",
      "error",
    ),
  });

  useEffect(() => () => {
    if (profileImagePreviewUrl) URL.revokeObjectURL(profileImagePreviewUrl);
  }, [profileImagePreviewUrl]);

  useEffect(() => {
    if (!profileModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProfileModal();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeProfileModal, profileModal]);

  useEffect(() => {
    if (status !== "anonymous" || signingOutRef.current) return;
    openLogin("/mypage");
    router.replace("/");
  }, [openLogin, router, status]);

  useEffect(() => {
    if (status !== "authenticated" || !memberId || withdrawalResumeRef.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("withdraw") !== "reauthenticated") return;

    withdrawalResumeRef.current = true;
    url.searchParams.delete("withdraw");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    const unlinkRequest = readSocialUnlinkRequest();
    clearSocialUnlinkRequest();
    if (unlinkRequest?.action !== "withdraw-member" || unlinkRequest.memberId !== memberId) {
      notify("탈퇴를 요청한 계정과 다른 계정으로 로그인했어요. 원래 계정으로 다시 시도해 주세요.", "error");
      return;
    }

    queueMicrotask(() => void completeWithdrawal());
  }, [completeWithdrawal, memberId, notify, status]);

  function openProfileModal(
    nextModal: "profile" | "avatar-preview" | "demographics" | "withdraw",
    trigger: HTMLElement,
  ) {
    modalTriggerRef.current = trigger;
    setNicknameDraft(member?.nickname ?? "");
    setProfileImageDraft(null);
    setProfileImagePreviewUrl(null);
    setGenderDraft(member?.gender ?? "UNKNOWN");
    setAgeGroupDraft(member?.ageGroup ?? "UNKNOWN");
    setProfileModal(nextModal);
  }

  function signOut() {
    signingOutRef.current = true;
    void logout().then(() => router.replace("/"));
  }

  function closeReviewDeleteDialog() {
    if (deleteMutation.isPending) return;
    setReviewToDelete(null);
    window.requestAnimationFrame(() => reviewDeleteTriggerRef.current?.focus());
  }

  function requestReviewDeletion(review: MyReview, trigger: HTMLButtonElement) {
    reviewDeleteTriggerRef.current = trigger;
    setReviewToDelete(review);
  }

  function startSocialLink(provider: SocialProvider) {
    if (!memberId || !socialsQuery.isSuccess) {
      notify("연동된 소셜 정보를 확인한 뒤 다시 시도해 주세요.", "info");
      return;
    }
    sessionStorage.setItem(SOCIAL_LINK_MEMBER_KEY, memberId);
    window.location.assign(
      bbangbatApi.socialLinkUrl(socialProviderCopy[provider].value, window.location.origin),
    );
  }

  function startSocialUnlinkReauthentication(provider: SocialProvider) {
    if (!memberId) return;
    storeSocialUnlinkRequest({ action: "unlink-social", memberId, provider });
    window.location.assign(
      bbangbatApi.socialUnlinkUrl(socialProviderCopy[provider].value, window.location.origin),
    );
  }

  function toggleSocial(
    provider: SocialProvider,
    linked: boolean,
    current: boolean,
    lastLinked: boolean,
  ) {
    if (linked) {
      if (current || lastLinked || !canUnlinkSocial(provider, resolvedCurrentSocialProvider)) return;
      socialUnlinkMutation.mutate(provider);
      return;
    }
    startSocialLink(provider);
  }

  function saveProfile() {
    if (!featureFlags.memberProfileEditing) {
      notify("프로필 수정 기능은 준비 중이에요.", "info");
      return;
    }
    const nickname = nicknameDraft;
    if (!isValidNickname(nickname)) {
      notify(NICKNAME_ERROR_MESSAGE, "error");
      return;
    }
    if (nicknameStatus === "checking") {
      notify("닉네임을 확인하고 있어요.", "info");
      return;
    }
    if (nicknameStatus === "taken") {
      notify("이미 사용 중인 닉네임이에요.", "error");
      return;
    }
    const nextNickname = nickname === member?.nickname ? undefined : nickname;
    if (!nextNickname && !profileImageDraft) {
      notify("변경된 프로필 정보가 없어요.", "info");
      return;
    }
    profileMutation.mutate({ nickname: nextNickname, image: profileImageDraft });
  }

  function selectProfileImage(fileList: FileList | null) {
    if (!featureFlags.memberProfileEditing) {
      notify("프로필 사진 수정 기능은 준비 중이에요.", "info");
      return;
    }
    const file = fileList?.[0];
    if (!file) return;
    if (!supportedProfileImageTypes.includes(file.type)) {
      notify("JPG, PNG, WebP 이미지만 선택할 수 있어요.", "error");
      return;
    }
    setProfileImageDraft(file);
    setProfileImagePreviewUrl(URL.createObjectURL(file));
  }

  function openProfileImagePicker() {
    if (!featureFlags.memberProfileEditing) {
      notify("프로필 사진 수정 기능은 준비 중이에요.", "info");
      return;
    }
    profileImageInputRef.current?.click();
  }

  function startEditingName() {
    if (!featureFlags.memberNameEditing) {
      notify("이름 수정 기능은 준비 중이에요.", "info");
      return;
    }
    setNameDraft(member?.name ?? "");
    setEditingName(true);
  }

  function saveName() {
    if (!featureFlags.memberNameEditing) {
      notify("이름 수정 기능은 준비 중이에요.", "info");
      return;
    }
    if (!isValidName(nameDraft)) {
      notify("이름은 1~30자로 입력해 주세요.", "error");
      return;
    }
    if (nameDraft === member?.name) {
      setEditingName(false);
      return;
    }
    nameMutation.mutate(nameDraft);
  }

  function saveDemographics() {
    if (!genderDraft || !ageGroupDraft) return;
    const gender = genderDraft === member?.gender ? undefined : genderDraft;
    const ageGroup = ageGroupDraft === member?.ageGroup ? undefined : ageGroupDraft;
    if (!gender && !ageGroup) {
      notify("변경된 정보가 없어요.", "info");
      return;
    }
    demographicsMutation.mutate({ gender, ageGroup });
  }

  if (status === "initializing") {
    return (
      <main className="mypage-standalone-state">
        <MypageMapLink />
        <LoadingState label="마이페이지를 여는 중" />
      </main>
    );
  }

  if (status === "anonymous") {
    return null;
  }

  const stats = statsQuery.data;
  const recentReviews = (reviewsQuery.data ?? []).slice(0, 3);

  return (
    <main className="mypage-dashboard" data-tab={initialTab}>
      <header className="mypage-mobile-header">
        <MypageMapLink />
        <h1>{mypageTabTitles[initialTab]}</h1>
        <span aria-hidden="true" />
      </header>
      <div className="mypage-dashboard-shell">
        <div className="mypage-sidebar-column">
          <MypageMapLink />
          <aside className="mypage-sidebar" aria-label="마이페이지 메뉴">
            <div className="mypage-sidebar-profile">
              <div className="mypage-sidebar-avatar-wrap">
                <button
                  type="button"
                  className="mypage-avatar-preview"
                  onClick={(event) => openProfileModal("avatar-preview", event.currentTarget)}
                  aria-label="프로필 사진 크게 보기"
                >
                  <MemberAvatar imageUrl={member?.profileImageUrl} className="mypage-sidebar-avatar" />
                </button>
              </div>
              <div className="mypage-sidebar-profile-copy">
                <strong>{member?.nickname}</strong>
                <button
                  type="button"
                  onClick={(event) => openProfileModal("profile", event.currentTarget)}
                >
                  프로필 수정
                </button>
              </div>
            </div>

            <div className="mypage-menu-group">
              <p>활동</p>
              <nav>
                {activityNavigation.map(({ tab, label, href, Icon }) => (
                  <Link key={tab} href={href} data-active={initialTab === tab} aria-current={initialTab === tab ? "page" : undefined}>
                    <Icon aria-hidden="true" size={18} />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="mypage-menu-group mypage-settings-menu">
              <p>설정</p>
              <nav>
                <Link href="/mypage?tab=profile" data-active={initialTab === "profile"} aria-current={initialTab === "profile" ? "page" : undefined}>
                  <Settings aria-hidden="true" size={18} />
                  <span>계정 정보</span>
                </Link>
                <button type="button" onClick={signOut}>
                  <LogOut aria-hidden="true" size={18} />
                  <span>로그아웃</span>
                </button>
              </nav>
            </div>
          </aside>
        </div>

        <section className="mypage-dashboard-content">
          {initialTab === "overview" ? (
            <section className="mypage-content-section" aria-labelledby="mypage-overview-title">
              <div className="mypage-section-heading">
                <div><h2 id="mypage-overview-title">내 활동</h2></div>
              </div>
              <div className="mypage-summary-grid">
                <Link href="/mypage?tab=reviews"><NotebookText aria-hidden="true" size={23} /><span>내 빵명록</span><strong>{stats?.reviewCount ?? 0}</strong></Link>
                <Link href="/mypage?tab=favorites"><Heart aria-hidden="true" size={23} /><span>나만의 빵지도</span><strong>{stats?.favoriteCount ?? 0}</strong></Link>
                <div><MessageCircleMore aria-hidden="true" size={23} /><span>실시간 톡</span><strong>{stats?.talkCount ?? 0}</strong></div>
              </div>

              <div className="mypage-overview-columns">
                <section className="mypage-overview-block" aria-labelledby="mypage-recent-reviews-title">
                  <div className="mypage-overview-heading">
                    <h3 id="mypage-recent-reviews-title">내 빵명록 모아보기</h3>
                    <Link href="/mypage?tab=reviews">전체보기 <ChevronRight aria-hidden="true" size={14} /></Link>
                  </div>
                  {reviewsQuery.isLoading ? <LoadingState label="빵명록을 불러오는 중" /> : null}
                  {!reviewsQuery.isLoading && (reviewsQuery.isError || recentReviews.length === 0) ? <p className="mypage-overview-empty">아직 남긴 빵명록이 없어요.</p> : null}
                  <div className="mypage-overview-list">
                    {recentReviews.map((review) => (
                      <article key={review.id} className="mypage-review-preview-card">
                        <Link
                          href={reviewMapHref(review.storeId, review.id)}
                          className="mypage-review-preview"
                        >
                          <MypageReviewCardContent review={review} compact />
                        </Link>
                        <button
                          type="button"
                          className="my-review-delete"
                          onClick={(event) => requestReviewDeletion(review, event.currentTarget)}
                          disabled={deleteMutation.isPending}
                        >
                          삭제
                        </button>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="mypage-overview-block" aria-labelledby="mypage-recent-favorites-title">
                  <div className="mypage-overview-heading">
                    <h3 id="mypage-recent-favorites-title">나만의 빵지도</h3>
                    <Link href="/mypage?tab=favorites">전체보기 <ChevronRight aria-hidden="true" size={14} /></Link>
                  </div>
                  {favoriteIdsQuery.isLoading || favoriteStoresQuery.isLoading ? <LoadingState label="나만의 빵지도를 불러오는 중" /> : null}
                  {!favoriteIdsQuery.isLoading && !favoriteStoresQuery.isLoading && (favoriteIdsQuery.isError || favoriteStoresQuery.isError || favoriteStoresQuery.data?.length === 0) ? <p className="mypage-overview-empty">아직 저장한 빵집이 없어요.</p> : null}
                  <div className="mypage-overview-list">
                    {favoriteStoresQuery.data?.slice(0, 5).map((store) => (
                      <StoreCard
                        key={store.id}
                        dense
                        store={store}
                        congestion={favoriteCongestionByStore.get(store.id)}
                        showCongestion
                        onSelect={(storeId) => router.push(`/?storeId=${storeId}&detail=sidebar`)}
                        isFavorite
                        favoritePending={favoriteMutation.isPending && favoriteMutation.variables?.id === store.id}
                        onToggleFavorite={() => favoriteMutation.mutate(store)}
                      />
                    ))}
                  </div>
                </section>
              </div>
            </section>
          ) : null}

          {initialTab === "reviews" ? (
            <section className="mypage-content-section my-reviews" aria-labelledby="mypage-reviews-title">
              <div className="mypage-section-heading">
                <div><h2 id="mypage-reviews-title">내 빵명록</h2></div>
              </div>
              {reviewsQuery.isLoading ? <LoadingState label="빵명록을 펼치는 중" /> : null}
              {!reviewsQuery.isLoading && (reviewsQuery.isError || reviewsQuery.data?.length === 0) ? <p className="mypage-tab-empty">아직 남긴 빵명록이 없어요.</p> : null}
              <div className="my-review-grid">
                {reviewsQuery.data?.map((review) => (
                  <article key={review.id} className="mypage-review-card">
                    <Link
                      href={reviewMapHref(review.storeId, review.id)}
                      className="my-review-content"
                    >
                      <MypageReviewCardContent review={review} />
                    </Link>
                    <button
                      type="button"
                      className="my-review-delete"
                      onClick={(event) => requestReviewDeletion(review, event.currentTarget)}
                      disabled={deleteMutation.isPending}
                    >
                      삭제
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {initialTab === "favorites" ? (
            <section className="mypage-content-section" aria-labelledby="mypage-favorites-title">
              <div className="mypage-section-heading">
                <div><h2 id="mypage-favorites-title">나만의 빵지도</h2></div>
              </div>
              {favoriteIdsQuery.isLoading || favoriteStoresQuery.isLoading ? <LoadingState label="나만의 빵지도를 불러오는 중" /> : null}
              {!favoriteIdsQuery.isLoading && !favoriteStoresQuery.isLoading && (favoriteIdsQuery.isError || favoriteStoresQuery.isError || favoriteStoresQuery.data?.length === 0) ? <p className="mypage-tab-empty">아직 저장한 빵집이 없어요.</p> : null}
              <div className="mypage-favorite-grid">
                {favoriteStoresQuery.data?.map((store) => (
                  <StoreCard
                    key={store.id}
                    dense
                    store={store}
                    congestion={favoriteCongestionByStore.get(store.id)}
                    showCongestion
                    onSelect={(storeId) => router.push(`/?storeId=${storeId}&detail=sidebar`)}
                    isFavorite
                    favoritePending={favoriteMutation.isPending && favoriteMutation.variables?.id === store.id}
                    onToggleFavorite={() => favoriteMutation.mutate(store)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {initialTab === "profile" ? (
            <section className="mypage-content-section" aria-labelledby="mypage-profile-title">
              <div className="mypage-section-heading">
                <div><h2 id="mypage-profile-title">계정 정보</h2></div>
              </div>
              <div className="mypage-account-card">
                <div className="mypage-name-row">
                  <span>이름</span>
                  {editingName ? (
                    <div className="mypage-name-editor">
                      <input
                        autoFocus
                        value={nameDraft}
                        maxLength={NAME_MAX_LENGTH}
                        onChange={(event) => setNameDraft(limitTextInput(event.target.value, NAME_MAX_LENGTH))}
                        aria-label="이름"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingName(false)}
                        disabled={nameMutation.isPending}
                      >
                        취소
                      </button>
                      <button type="button" onClick={saveName} disabled={nameMutation.isPending}>
                        {nameMutation.isPending ? "저장 중…" : "저장"}
                      </button>
                    </div>
                  ) : (
                    <div className="mypage-account-value">
                      <strong>{member?.name}</strong>
                      <button type="button" onClick={startEditingName}>수정</button>
                    </div>
                  )}
                </div>
                <div><span>이메일</span><strong>{member?.email}</strong></div>
                <div>
                  <span>성별</span>
                  <div className="mypage-account-value">
                    <strong>{member ? GENDER_LABEL[member.gender] : "-"}</strong>
                    <button
                      type="button"
                      aria-label="성별 수정"
                      onClick={(event) => openProfileModal("demographics", event.currentTarget)}
                    >
                      수정
                    </button>
                  </div>
                </div>
                <div>
                  <span>연령대</span>
                  <div className="mypage-account-value">
                    <strong>{member ? AGE_GROUP_LABEL[member.ageGroup] : "-"}</strong>
                    <button
                      type="button"
                      aria-label="연령대 수정"
                      onClick={(event) => openProfileModal("demographics", event.currentTarget)}
                    >
                      수정
                    </button>
                  </div>
                </div>
              </div>
              <section className="mypage-account-section" aria-labelledby="mypage-social-title">
                <h3 id="mypage-social-title">소셜 연동</h3>
                {socialProviders.map((provider) => {
                  const copy = socialProviderCopy[provider];
                  const social = socialsQuery.data?.find((item) => item.provider === provider);
                  const linked = Boolean(social);
                  const current = linked && provider === resolvedCurrentSocialProvider;
                  const lastLinked = linked && socialsQuery.data?.length === 1;
                  const pending = socialUnlinkMutation.isPending
                    && socialUnlinkMutation.variables === provider;
                  return (
                    <div className="mypage-social-row" key={provider}>
                      <span>
                        <i data-provider={copy.value} aria-hidden="true">{copy.symbol}</i>
                        {copy.label}
                        {current ? <em className="mypage-current-social">현재 로그인</em> : null}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={linked}
                        aria-label={current
                          ? `${copy.label} 계정 현재 로그인 중, 연동 해제 불가`
                          : lastLinked
                            ? `${copy.label} 계정 마지막 연동 수단, 연동 해제 불가`
                            : `${copy.label} 계정 ${linked ? "연동 해제" : "연동"}`}
                        data-current={current}
                        disabled={!socialsQuery.isSuccess || pending || current || lastLinked}
                        onClick={() => toggleSocial(provider, linked, current, lastLinked)}
                      >
                        <i />
                      </button>
                    </div>
                  );
                })}
                {socialsQuery.isLoading ? <p className="mypage-social-state">연동 정보를 확인하는 중…</p> : null}
                {socialsQuery.isError ? <p className="mypage-social-state">연동 정보를 불러오지 못했어요.</p> : null}
              </section>
              <section className="mypage-account-section mypage-withdrawal" aria-labelledby="mypage-withdrawal-title">
                <h3 id="mypage-withdrawal-title">회원 탈퇴</h3>
                <button
                  type="button"
                  onClick={(event) => openProfileModal("withdraw", event.currentTarget)}
                >
                  탈퇴하기
                </button>
              </section>
            </section>
          ) : null}
        </section>
      </div>

      <footer className="mypage-footer">
        <span>© 2026 빵밭. All rights reserved.</span>
        <span className="mypage-footer-links">
          <Link href="/privacy">개인정보처리방침</Link>
          <i aria-hidden="true">|</i>
          <Link href="/terms">서비스 이용약관</Link>
        </span>
      </footer>

      <nav className="mypage-mobile-nav" aria-label="마이페이지 메뉴">
        {activityNavigation.map(({ tab, label, href, Icon }) => (
          <Link
            key={tab}
            href={href}
            data-active={initialTab === tab}
            aria-current={initialTab === tab ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{label}</span>
          </Link>
        ))}
        <Link
          href="/mypage?tab=profile"
          data-active={initialTab === "profile"}
          aria-current={initialTab === "profile" ? "page" : undefined}
        >
          <Settings aria-hidden="true" size={18} />
          <span>계정 정보</span>
        </Link>
        <button type="button" onClick={signOut} aria-label="로그아웃">
          <LogOut aria-hidden="true" size={18} />
          <span>로그아웃</span>
        </button>
      </nav>

      <ConfirmDialog
        open={Boolean(reviewToDelete)}
        title="정말 이 빵명록을 삭제하시겠어요?"
        description="삭제한 빵명록은 복구할 수 없어요."
        confirmLabel="삭제하기"
        pendingLabel="삭제 중…"
        pending={deleteMutation.isPending}
        onCancel={closeReviewDeleteDialog}
        onConfirm={() => {
          if (reviewToDelete) deleteMutation.mutate(reviewToDelete.id);
        }}
      />

      {profileModal ? (
        <div
          className="profile-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProfileModal();
          }}
        >
          <section
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={profileModal === "avatar-preview" ? undefined : "profile-modal-title"}
            aria-label={profileModal === "avatar-preview" ? "프로필 사진 확대 보기" : undefined}
            data-kind={profileModal}
          >
            {profileModal !== "withdraw" ? (
              <button type="button" className="profile-modal-close" onClick={closeProfileModal} aria-label="닫기" autoFocus>
                <X aria-hidden="true" size={19} />
              </button>
            ) : null}
            {profileModal === "profile" ? (
              <>
                <h2 id="profile-modal-title">프로필 수정</h2>
                <div className="profile-edit-photo">
                  <button
                    type="button"
                    className="profile-edit-photo-preview"
                    onClick={openProfileImagePicker}
                    disabled={profileMutation.isPending}
                    aria-label="프로필 사진 변경"
                  >
                    <MemberAvatar imageUrl={profileImagePreviewUrl ?? member?.profileImageUrl} className="profile-avatar-edit-preview" />
                    <span className="profile-edit-photo-action" aria-hidden="true">
                      <Pencil size={14} strokeWidth={2.4} />
                    </span>
                  </button>
                </div>
                <input
                  ref={profileImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="profile-photo-input"
                  onChange={(event) => {
                    selectProfileImage(event.target.files);
                    event.target.value = "";
                  }}
                />
                <div className="profile-nickname-field">
                  <span id="profile-nickname-label">닉네임</span>
                  <div className="field-with-button" data-availability={nicknameStatus}>
                    <UserRound aria-hidden="true" size={18} />
                    <input
                      className="field"
                      value={nicknameDraft}
                      onChange={(event) => setNicknameDraft(limitTextInput(event.target.value, NICKNAME_MAX_LENGTH))}
                      minLength={2}
                      maxLength={NICKNAME_MAX_LENGTH}
                      pattern="[가-힣A-Za-z0-9]{2,10}"
                      title={NICKNAME_ERROR_MESSAGE}
                      aria-labelledby="profile-nickname-label"
                      aria-invalid={nicknamePatternInvalid || nicknameStatus === "taken"}
                    />
                    {nicknameStatus === "available" ? <Check aria-label="사용 가능" size={17} /> : null}
                  </div>
                  {nicknameStatus === "taken" ? <p className="field-error">이미 사용 중인 닉네임이에요.</p> : null}
                  {nicknamePatternInvalid ? <p className="field-error">{NICKNAME_ERROR_MESSAGE}</p> : null}
                </div>
                <div className="profile-modal-actions">
                  <button type="button" className="button button-secondary" onClick={closeProfileModal}>취소</button>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={profileMutation.isPending || nicknameStatus === "checking" || nicknameStatus === "taken"}
                    onClick={saveProfile}
                  >
                    {profileMutation.isPending ? "저장 중…" : "저장"}
                  </button>
                </div>
              </>
            ) : null}
            {profileModal === "avatar-preview" ? (
              <MemberAvatar imageUrl={member?.profileImageUrl} className="profile-avatar-preview" />
            ) : null}
            {profileModal === "demographics" ? (
              <>
                <h2 id="profile-modal-title">성별·연령대 수정</h2>
                <div className="profile-demographics-fields">
                  <fieldset className="profile-demographics-field">
                    <legend>성별</legend>
                    <div className="choice-grid choice-grid-gender">
                      {GENDER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          data-selected={genderDraft === option.value}
                          aria-pressed={genderDraft === option.value}
                          onClick={() => setGenderDraft(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="profile-demographics-field">
                    <legend>연령대</legend>
                    <div className="choice-grid choice-grid-age">
                      {AGE_GROUP_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          data-selected={ageGroupDraft === option.value}
                          aria-pressed={ageGroupDraft === option.value}
                          onClick={() => setAgeGroupDraft(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="profile-modal-actions">
                  <button type="button" className="button button-secondary" onClick={closeProfileModal}>취소</button>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={demographicsMutation.isPending}
                    onClick={saveDemographics}
                  >
                    {demographicsMutation.isPending ? "저장 중…" : "저장"}
                  </button>
                </div>
              </>
            ) : null}
            {profileModal === "withdraw" ? (
              <>
                <h2 id="profile-modal-title">정말 빵밭을 떠나시겠어요?</h2>
                <div className="profile-withdraw-copy">
                  <p>회원 정보, 소셜 연동, 나만의 빵지도와 혼잡도 투표는 삭제되며 복구할 수 없어요.</p>
                  <p>작성한 빵명록과 실시간 톡은 삭제되지 않고 서비스 기록으로 남아요.</p>
                </div>
                <div className="profile-modal-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={closeProfileModal}
                    disabled={withdrawalPending}
                    autoFocus
                  >
                    계속 이용하기
                  </button>
                  <button
                    type="button"
                    className="button profile-withdraw-confirm"
                    onClick={requestWithdrawalReauthentication}
                    disabled={withdrawalPending}
                  >
                    {withdrawalPending ? "탈퇴 처리 중…" : "탈퇴하기"}
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

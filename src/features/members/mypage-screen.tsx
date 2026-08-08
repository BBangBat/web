"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageCircleMore,
  NotebookText,
  Pencil,
  Settings,
  Star,
  X,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { MemberAvatar } from "@/features/members/member-avatar";
import { StoreCard } from "@/features/stores/store-card";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { featureFlags } from "@/shared/config/features";
import {
  compactAddress,
  congestionCopy,
  hasStoreImage,
  relativeTime,
} from "@/shared/lib/format";
import { isValidNickname, limitTextInput } from "@/shared/lib/text-input";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { LoadingState } from "@/shared/ui/states";

export type MypageTab = "overview" | "reviews" | "favorites" | "profile";

const activityNavigation = [
  { tab: "overview", label: "전체보기", href: "/mypage", Icon: LayoutDashboard },
  { tab: "reviews", label: "내 빵명록", href: "/mypage?tab=reviews", Icon: NotebookText },
  { tab: "favorites", label: "나만의 빵지도", href: "/mypage?tab=favorites", Icon: Heart },
] as const;

const supportedProfileImageTypes = ["image/jpeg", "image/png", "image/webp"];

function MypageMapLink() {
  return (
    <Link href="/" className="mypage-map-link">
      <ArrowLeft aria-hidden="true" size={21} />
      <span>지도로 돌아가기</span>
    </Link>
  );
}

function formatWrittenDate(value: string | null) {
  if (!value) return "오늘";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function MypageScreen({ initialTab }: { initialTab: MypageTab }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, memberId, member, status, updateMember, logout } = useAuth();
  const { openLogin } = useLoginModal();
  const { notify } = useFeedback();
  const [profileModal, setProfileModal] = useState<"nickname" | "avatar-preview" | "avatar-edit" | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const signingOutRef = useRef(false);
  const statsQuery = useQuery({
    queryKey: ["member-stats", memberId],
    queryFn: () => bbangbatApi.getMemberStats(memberId!, accessToken!),
    enabled: Boolean(accessToken && memberId),
  });
  const reviewsQuery = useQuery({
    queryKey: ["my-reviews", memberId],
    queryFn: () => bbangbatApi.getMyReviews(memberId!, accessToken!),
    enabled: Boolean(accessToken && memberId) && (initialTab === "overview" || initialTab === "reviews"),
  });
  const favoriteIdsQuery = useQuery({
    queryKey: ["favorites", memberId],
    queryFn: () => bbangbatApi.getFavorites(memberId!, accessToken!),
    enabled: Boolean(accessToken && memberId) && (initialTab === "overview" || initialTab === "favorites"),
  });
  const requestedFavoriteIds = initialTab === "overview"
    ? (favoriteIdsQuery.data ?? []).slice(0, 3)
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
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewId: number) => bbangbatApi.deleteReview(reviewId, memberId!, accessToken!),
    onSuccess: async () => {
      notify("빵명록을 삭제했어요.", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["member-stats"] }),
      ]);
    },
    onError: (error) => notify(error instanceof Error ? error.message : "삭제하지 못했어요.", "error"),
  });

  const closeProfileModal = useCallback(() => {
    setProfileModal(null);
    window.requestAnimationFrame(() => modalTriggerRef.current?.focus());
  }, []);

  const nicknameMutation = useMutation({
    mutationFn: (nickname: string) => bbangbatApi.updateProfile({ nickname }, accessToken!),
    onSuccess: (nextMember) => {
      updateMember(nextMember);
      closeProfileModal();
      notify("닉네임을 수정했어요.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "닉네임을 수정하지 못했어요.", "error"),
  });

  const profileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const profileImageKey = await bbangbatApi.uploadProfileImage(file, accessToken!);
      return bbangbatApi.updateProfile({ profileImageKey }, accessToken!);
    },
    onSuccess: (nextMember) => {
      updateMember(nextMember);
      closeProfileModal();
      notify("프로필 사진을 수정했어요.", "success");
    },
    onError: (error) => notify(error instanceof Error ? error.message : "프로필 사진을 수정하지 못했어요.", "error"),
  });

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

  function openProfileModal(nextModal: "nickname" | "avatar-preview" | "avatar-edit", trigger: HTMLElement) {
    modalTriggerRef.current = trigger;
    setNicknameDraft(member?.nickname ?? "");
    setProfileModal(nextModal);
  }

  function signOut() {
    signingOutRef.current = true;
    void logout().then(() => router.replace("/"));
  }

  function saveNickname() {
    if (!featureFlags.memberProfileEditing) {
      notify("닉네임 수정 기능은 준비 중이에요.", "info");
      return;
    }
    if (!isValidNickname(nicknameDraft)) {
      notify("닉네임은 2자 이상 20자 이하로 입력해 주세요.", "error");
      return;
    }
    nicknameMutation.mutate(nicknameDraft.trim());
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
    profileImageMutation.mutate(file);
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
    if (!nameDraft.trim()) {
      notify("이름을 입력해 주세요.", "error");
      return;
    }
    notify("이름 수정 기능은 준비 중이에요.", "info");
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
  const congestionByStore = new Map(
    (favoriteCongestionsQuery.data ?? []).map((congestion) => [congestion.storeId, congestion]),
  );

  return (
    <main className="mypage-dashboard">
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
                <button
                  type="button"
                  className="mypage-avatar-edit"
                  onClick={(event) => {
                    if (!featureFlags.memberProfileEditing) {
                      notify("프로필 사진 수정 기능은 준비 중이에요.", "info");
                      return;
                    }
                    openProfileModal("avatar-edit", event.currentTarget);
                  }}
                  aria-label="프로필 사진 수정"
                >
                  <Pencil aria-hidden="true" size={10} strokeWidth={2.4} />
                </button>
              </div>
              <div className="mypage-sidebar-profile-copy">
                <strong>{member?.nickname}</strong>
                <button
                  type="button"
                  onClick={(event) => {
                    if (!featureFlags.memberProfileEditing) {
                      notify("닉네임 수정 기능은 준비 중이에요.", "info");
                      return;
                    }
                    openProfileModal("nickname", event.currentTarget);
                  }}
                >
                  닉네임 수정
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
                    {recentReviews.map((review) => {
                      const thumbnail = review.imageUrls[0] || review.storeImageUrl;
                      return (
                        <Link key={review.id} href={`/?storeId=${review.storeId}`} className="mypage-review-preview">
                          <div className="mypage-preview-thumbnail" style={{ backgroundImage: `url(${thumbnail})` }} aria-hidden="true" />
                          <div className="mypage-review-preview-copy">
                            <div><strong>{review.storeName}</strong><span><Star aria-hidden="true" size={12} fill="currentColor" /> {review.rating.toFixed(1)}</span></div>
                            <p>{review.content}</p>
                            <div className="mypage-preview-meta"><span>{review.menus.join(", ")}</span><time>{formatWrittenDate(review.createdAt)}</time></div>
                          </div>
                        </Link>
                      );
                    })}
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
                    {favoriteStoresQuery.data?.slice(0, 3).map((store) => {
                      const congestion = congestionByStore.get(store.id);
                      return (
                        <button type="button" key={store.id} className="mypage-favorite-preview" onClick={() => router.push(`/?storeId=${store.id}`)}>
                          <div
                            className="mypage-preview-thumbnail"
                            style={hasStoreImage(store.imageUrl) ? { backgroundImage: `url(${store.imageUrl})` } : undefined}
                            aria-hidden="true"
                          />
                          <div className="mypage-favorite-preview-copy">
                            <strong>{store.name}</strong>
                            <p>{compactAddress(store.address)}</p>
                            {congestion ? (
                              <span className={`mypage-preview-congestion congestion-${congestion.current.toLowerCase()}`}>
                                <i aria-hidden="true" /> {congestionCopy[congestion.current].shortLabel}
                              </span>
                            ) : <span className="mypage-preview-congestion-loading">혼잡도 확인 중</span>}
                          </div>
                        </button>
                      );
                    })}
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
                  <article key={review.id}>
                    <Link href={`/?storeId=${review.storeId}`} className="my-review-store">
                      <div style={{ backgroundImage: `url(${review.storeImageUrl})` }} aria-hidden="true" />
                      <span><strong>{review.storeName}</strong><small>{relativeTime(review.createdAt)}</small></span>
                      <ChevronRight aria-hidden="true" size={17} />
                    </Link>
                    <p className="review-rating"><Star aria-hidden="true" size={14} fill="currentColor" /> {review.rating.toFixed(1)}</p>
                    <div className="menu-tags">{review.menus.map((menu) => <span key={menu}>{menu}</span>)}</div>
                    <p>{review.content}</p>
                    <button type="button" onClick={() => deleteMutation.mutate(review.id)} disabled={deleteMutation.isPending}>삭제</button>
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
                    showCongestion
                    store={store}
                    congestion={congestionByStore.get(store.id)}
                    onSelect={(storeId) => router.push(`/?storeId=${storeId}`)}
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
                        maxLength={30}
                        onChange={(event) => setNameDraft(limitTextInput(event.target.value, 30))}
                        aria-label="이름"
                      />
                      <button type="button" onClick={() => setEditingName(false)}>취소</button>
                      <button type="button" onClick={saveName}>저장</button>
                    </div>
                  ) : (
                    <div className="mypage-account-value">
                      <strong>{member?.name}</strong>
                      <button type="button" onClick={startEditingName}>수정</button>
                    </div>
                  )}
                </div>
                <div><span>이메일</span><strong>{member?.email}</strong></div>
              </div>
              <section className="mypage-account-section" aria-labelledby="mypage-social-title">
                <h3 id="mypage-social-title">소셜 연동</h3>
                <div className="mypage-social-row"><span><i data-provider="kakao" aria-hidden="true">K</i>카카오</span><button type="button" role="switch" aria-checked="false" aria-label="카카오 계정 연동" onClick={() => notify("소셜 계정 연동 기능은 준비 중이에요.", "info")}><i /></button></div>
                <div className="mypage-social-row"><span><i data-provider="naver" aria-hidden="true">N</i>네이버</span><button type="button" role="switch" aria-checked="false" aria-label="네이버 계정 연동" onClick={() => notify("소셜 계정 연동 기능은 준비 중이에요.", "info")}><i /></button></div>
              </section>
              <section className="mypage-account-section mypage-withdrawal" aria-labelledby="mypage-withdrawal-title">
                <h3 id="mypage-withdrawal-title">회원 탈퇴</h3>
                <button type="button" onClick={() => notify("회원 탈퇴 기능은 준비 중이에요.", "info")}>탈퇴하기</button>
              </section>
            </section>
          ) : null}
        </section>
      </div>

      {profileModal ? (
        <div
          className="profile-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProfileModal();
          }}
        >
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
            <button type="button" className="profile-modal-close" onClick={closeProfileModal} aria-label="닫기" autoFocus={profileModal !== "nickname"}>
              <X aria-hidden="true" size={19} />
            </button>
            {profileModal === "nickname" ? (
              <>
                <h2 id="profile-modal-title">닉네임 수정</h2>
                <label className="profile-nickname-field">
                  <span>닉네임</span>
                  <input autoFocus value={nicknameDraft} onChange={(event) => setNicknameDraft(limitTextInput(event.target.value, 20))} minLength={2} maxLength={20} />
                  <small>{Array.from(nicknameDraft).length}/20</small>
                </label>
                <div className="profile-modal-actions">
                  <button type="button" className="button button-secondary" onClick={closeProfileModal}>취소</button>
                  <button type="button" className="button button-primary" disabled={nicknameMutation.isPending} onClick={saveNickname}>
                    {nicknameMutation.isPending ? "저장 중…" : "저장"}
                  </button>
                </div>
              </>
            ) : null}
            {profileModal === "avatar-preview" ? (
              <>
                <h2 id="profile-modal-title">프로필 사진</h2>
                <MemberAvatar imageUrl={member?.profileImageUrl} className="profile-avatar-preview" />
              </>
            ) : null}
            {profileModal === "avatar-edit" ? (
              <>
                <h2 id="profile-modal-title">프로필 사진 수정</h2>
                <MemberAvatar imageUrl={member?.profileImageUrl} className="profile-avatar-edit-preview" />
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
                <button
                  type="button"
                  className="button button-secondary profile-photo-select"
                  disabled={profileImageMutation.isPending}
                  onClick={() => {
                    if (!featureFlags.memberProfileEditing) {
                      notify("프로필 사진 수정 기능은 준비 중이에요.", "info");
                      return;
                    }
                    profileImageInputRef.current?.click();
                  }}
                >
                  {profileImageMutation.isPending ? "업로드 중…" : "사진 선택"}
                </button>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

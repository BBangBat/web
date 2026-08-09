"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Copy,
  Heart,
  MapPin,
  MessageCircleMore,
  Phone,
  RotateCw,
  Send,
  Star,
} from "lucide-react";
import type { Congestion, CongestionLevel, Store, TalkSummary } from "@/entities/types";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { MemberAvatar } from "@/features/members/member-avatar";
import {
  optimisticallySetFavorite,
  rollbackFavoriteCache,
} from "@/features/favorites/favorite-cache";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { featureFlags } from "@/shared/config/features";
import { getCongestionVoteCoordinates } from "@/shared/hooks/use-geolocation";
import {
  CONGESTION_VOTE_COOLDOWN_MINUTES,
  congestionVoteCooldownStorageKey,
  createCongestionVoteCooldownExpiry,
  createCongestionVoteCooldownExpiryFromSeconds,
  remainingCongestionVoteCooldownMinutes,
} from "@/shared/lib/congestion-vote-cooldown";
import {
  averageRating,
  compactReviewDate,
  compactAddress,
  congestionCopy,
  relativeTime,
} from "@/shared/lib/format";
import { limitTextInput } from "@/shared/lib/text-input";
import { useFeedback } from "@/shared/ui/feedback-provider";

const congestionLevels: CongestionLevel[] = ["UNCROWDED", "NORMAL", "CROWDED"];

function formatRefreshTime(updatedAt: number) {
  if (!updatedAt) return "--:--";
  const date = new Date(updatedAt);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

type RefreshStatusProps = {
  label: string;
  updatedAt: number;
  isFetching: boolean;
  onRefresh: () => void;
};

export function RefreshStatus({ label, updatedAt, isFetching, onRefresh }: RefreshStatusProps) {
  const time = formatRefreshTime(updatedAt);
  const [minimumSpin, setMinimumSpin] = useState(false);
  const spinLockRef = useRef(false);
  const spinTimerRef = useRef<number | null>(null);
  const startMinimumSpin = useCallback(() => {
    if (spinLockRef.current) return false;
    spinLockRef.current = true;
    setMinimumSpin(true);
    spinTimerRef.current = window.setTimeout(() => {
      spinLockRef.current = false;
      spinTimerRef.current = null;
      setMinimumSpin(false);
    }, 800);
    return true;
  }, []);

  useEffect(() => {
    if (isFetching) startMinimumSpin();
  }, [isFetching, startMinimumSpin]);

  useEffect(() => () => {
    if (spinTimerRef.current !== null) window.clearTimeout(spinTimerRef.current);
    spinTimerRef.current = null;
    spinLockRef.current = false;
  }, []);

  const spinning = minimumSpin;

  function refresh() {
    if (!startMinimumSpin()) return;
    onRefresh();
  }

  return (
    <button
      type="button"
      className="map-panel-refresh"
      aria-label={`${label} 새로고침, ${time} 기준`}
      aria-busy={isFetching}
      data-spinning={spinning}
      disabled={spinning}
      onClick={refresh}
    >
      <RotateCw aria-hidden="true" size={13} />
      <span>{time} 기준</span>
    </button>
  );
}

type StoreMapPanelProps = {
  store: Store;
  congestion?: Congestion;
  summary?: TalkSummary;
  placement?: "floating" | "sidebar";
  initialReviewId?: number | null;
  onClose: () => void;
};

type StorePanelTab = "live" | "reviews" | "menu";

export function ReviewPhotoGallery({ imageUrls }: { imageUrls: string[] }) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const mouseDragRef = useRef<{
    pointerId: number;
    startX: number;
    scrollLeft: number;
    moved: boolean;
  } | null>(null);

  function startMouseDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    mouseDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  }

  function moveMouseDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4 && !drag.moved) {
      drag.moved = true;
      event.currentTarget.dataset.dragging = "true";
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = drag.scrollLeft - distance;
  }

  function endMouseDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = mouseDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    mouseDragRef.current = null;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function showPhoto(index: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const gallery = galleryRef.current;
    if (!gallery || imageUrls.length < 2) return;
    const selectedPhoto = gallery.children.item(index);
    if (!(selectedPhoto instanceof HTMLElement)) return;
    gallery.scrollTo({
      left: Math.max(0, selectedPhoto.offsetLeft - gallery.offsetLeft),
      behavior: "smooth",
    });
  }

  return (
    <div
      ref={galleryRef}
      className="map-panel-review-gallery"
      data-single={imageUrls.length === 1}
      aria-label="빵명록 사진 목록"
      tabIndex={imageUrls.length > 1 ? 0 : undefined}
      onPointerDown={startMouseDrag}
      onPointerMove={moveMouseDrag}
      onPointerUp={endMouseDrag}
      onPointerCancel={endMouseDrag}
    >
      {imageUrls.map((imageUrl, index) => imageUrls.length > 1 ? (
        <button
          key={`${imageUrl}-${index}`}
          type="button"
          style={{ backgroundImage: `url(${imageUrl})` }}
          aria-label={`빵명록 사진 ${index + 1}/${imageUrls.length}, 클릭하면 이 사진 보기`}
          onClick={() => showPhoto(index)}
        />
      ) : (
        <div
          key={`${imageUrl}-${index}`}
          style={{ backgroundImage: `url(${imageUrl})` }}
          role="img"
          aria-label="빵명록 사진 1/1"
        />
      ))}
    </div>
  );
}

export function StoreMapPanel({
  store,
  congestion,
  summary,
  placement = "floating",
  initialReviewId = null,
  onClose,
}: StoreMapPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, memberId } = useAuth();
  const { openLogin } = useLoginModal();
  const { notify } = useFeedback();
  const [talkContent, setTalkContent] = useState("");
  const [selectedVote, setSelectedVote] = useState<CongestionLevel | null>(null);
  const [activePanelTab, setActivePanelTab] = useState<StorePanelTab>(
    initialReviewId ? "reviews" : "live",
  );
  const [voteCooldownMinutes, setVoteCooldownMinutes] = useState(0);
  const talkListRef = useRef<HTMLDivElement>(null);
  const panelContentRef = useRef<HTMLDivElement>(null);
  const reviewFocusHandledRef = useRef(false);
  const voteCooldownExpiryRef = useRef(0);

  useEffect(() => {
    const storageKey = congestionVoteCooldownStorageKey(store.id);
    voteCooldownExpiryRef.current = 0;
    const updateCooldown = () => {
      let expiresAt = voteCooldownExpiryRef.current;
      try {
        const storedExpiry = window.localStorage.getItem(storageKey);
        if (storedExpiry) expiresAt = Number(storedExpiry);
      } catch {
        // Keep the in-memory cooldown when browser storage is unavailable.
      }
      const remainingMinutes = Number.isFinite(expiresAt)
        ? remainingCongestionVoteCooldownMinutes(expiresAt)
        : 0;
      voteCooldownExpiryRef.current = remainingMinutes > 0 ? expiresAt : 0;
      setVoteCooldownMinutes(remainingMinutes);
      if (remainingMinutes === 0) {
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // Nothing else is required after the in-memory cooldown expires.
        }
      }
    };
    const syncCooldown = (event: StorageEvent) => {
      if (event.key === storageKey) updateCooldown();
    };

    updateCooldown();
    const interval = window.setInterval(updateCooldown, 15_000);
    window.addEventListener("storage", syncCooldown);
    window.addEventListener("focus", updateCooldown);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", syncCooldown);
      window.removeEventListener("focus", updateCooldown);
    };
  }, [store.id]);

  const congestionQuery = useQuery({
    queryKey: ["congestion", store.id],
    queryFn: () => bbangbatApi.getCongestion(store.id),
    refetchInterval: 60_000,
  });
  const talksQuery = useQuery({
    queryKey: ["talks", store.id],
    queryFn: () => bbangbatApi.getTalks(store.id),
    refetchInterval: 20_000,
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews", store.id],
    queryFn: () => bbangbatApi.getReviews(store.id),
  });
  const favoritesQuery = useQuery({
    queryKey: ["favorites", memberId],
    queryFn: () => bbangbatApi.getFavorites(accessToken!),
    enabled: Boolean(accessToken && memberId),
  });

  const currentCongestion = congestionQuery.data ?? congestion;
  const currentLevel = currentCongestion?.current ?? "UNCROWDED";
  const voteCounts: Record<CongestionLevel, number> = {
    UNCROWDED: currentCongestion?.uncrowdedVotes ?? 0,
    NORMAL: currentCongestion?.normalVotes ?? 0,
    CROWDED: currentCongestion?.crowdedVotes ?? 0,
  };
  const isFavorite = favoritesQuery.data?.includes(store.id) ?? false;
  const reviews = reviewsQuery.data ?? [];
  const reviewCount = reviews.length;
  const reviewTabCountLabel = reviewCount >= 100000
    ? "99,999+"
    : reviewCount.toLocaleString("ko-KR");
  const rating = averageRating(reviews);
  const ratingFillPercentage = rating === null ? 0 : Math.min(100, Math.max(0, rating * 20));
  const storeMenus = store.menus ?? [];
  const talks = useMemo(
    () => [...(talksQuery.data ?? [])].sort((left, right) => right.id - left.id),
    [talksQuery.data],
  );
  const talkCount = talks.length;

  useEffect(() => {
    if (
      !initialReviewId
      || activePanelTab !== "reviews"
      || !reviewsQuery.isSuccess
      || reviewFocusHandledRef.current
    ) return;

    const frame = window.requestAnimationFrame(() => {
      const content = panelContentRef.current;
      const target = content?.querySelector<HTMLElement>(`[data-review-id="${initialReviewId}"]`);
      if (!content || !target) return;
      const contentRect = content.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const centeredTop = content.scrollTop
        + targetRect.top
        - contentRect.top
        - (content.clientHeight - target.clientHeight) / 2;
      content.scrollTo({ top: Math.max(0, centeredTop), behavior: "smooth" });
      reviewFocusHandledRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activePanelTab, initialReviewId, reviewsQuery.data, reviewsQuery.isSuccess]);

  const favoriteMutation = useMutation({
    mutationFn: (nextFavorite: boolean) =>
      nextFavorite
        ? bbangbatApi.addFavorite(store.id, accessToken!)
        : bbangbatApi.removeFavorite(store.id, accessToken!),
    onMutate: (nextFavorite) =>
      optimisticallySetFavorite(queryClient, memberId!, store, nextFavorite),
    onSuccess: (_data, nextFavorite) => {
      notify(nextFavorite ? "나만의 빵지도에 저장했어요." : "나만의 빵지도에서 삭제했어요.", "success");
    },
    onError: (error, _nextFavorite, snapshot) => {
      rollbackFavoriteCache(queryClient, memberId!, snapshot);
      notify(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했어요.", "error");
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-stores"] }),
        queryClient.invalidateQueries({ queryKey: ["member-stats"] }),
      ]);
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (level: CongestionLevel) => {
      const coordinates = await getCongestionVoteCoordinates({
        developmentCoordinates: store,
      });
      if (!accessToken) await bbangbatApi.issueAnonymousToken();
      return bbangbatApi.voteCongestion(store.id, level, coordinates, accessToken);
    },
    onSuccess: async (nextCongestion) => {
      setSelectedVote(null);
      const cooldownExpiry = createCongestionVoteCooldownExpiry();
      voteCooldownExpiryRef.current = cooldownExpiry;
      try {
        window.localStorage.setItem(
          congestionVoteCooldownStorageKey(store.id),
          String(cooldownExpiry),
        );
      } catch {
        // The countdown still works for this session if browser storage is unavailable.
      }
      setVoteCooldownMinutes(remainingCongestionVoteCooldownMinutes(cooldownExpiry));
      queryClient.setQueryData(["congestion", store.id], nextCongestion);
      await queryClient.invalidateQueries({ queryKey: ["congestions"] });
      notify("실시간 혼잡도를 알려주셔서 고마워요.", "success");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "CONGESTION_VOTE_COOLDOWN") {
        const retryAfterSeconds = error.retryAfterSeconds;
        if (retryAfterSeconds !== undefined) {
          const cooldownExpiry = createCongestionVoteCooldownExpiryFromSeconds(retryAfterSeconds);
          voteCooldownExpiryRef.current = cooldownExpiry;
          try {
            window.localStorage.setItem(
              congestionVoteCooldownStorageKey(store.id),
              String(cooldownExpiry),
            );
          } catch {
            // The server-derived countdown still works for this session.
          }
          const remainingMinutes = remainingCongestionVoteCooldownMinutes(cooldownExpiry);
          setVoteCooldownMinutes(remainingMinutes);
          setSelectedVote(null);
          notify(`${remainingMinutes}분 뒤 다시 투표할 수 있어요.`, "info");
          return;
        }
      }
      if (error instanceof ApiError && error.code === "CONGESTION_VOTE_TOO_FAR") {
        notify("가게에서 300m 이내일 때만 투표할 수 있어요.", "info");
        return;
      }
      if (error instanceof ApiError && error.code === "OUT_OF_SERVICE_AREA") {
        notify("대전 서비스 지역 안에서만 투표할 수 있어요.", "info");
        return;
      }
      if (!accessToken && error instanceof ApiError && error.status === 401) {
        notify("비회원 투표용 쿠키를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
        return;
      }
      notify(error instanceof Error ? error.message : "혼잡도 투표를 남기지 못했어요.", "error");
    },
  });

  const talkMutation = useMutation({
    mutationFn: (content: string) => bbangbatApi.sendTalk(store.id, content, accessToken!),
    onSuccess: async () => {
      setTalkContent("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["talks", store.id] }),
        queryClient.invalidateQueries({ queryKey: ["talk-summaries"] }),
      ]);
      if (talkListRef.current) talkListRef.current.scrollTop = 0;
      notify("실시간 톡을 남겼어요.", "success");
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "실시간 톡을 남기지 못했어요.", "error");
    },
  });

  function toggleFavorite() {
    if (!accessToken || !memberId) {
      openLogin("/");
      return;
    }
    favoriteMutation.mutate(!isFavorite);
  }

  function submitTalk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !memberId) {
      openLogin("/");
      return;
    }
    const content = talkContent.trim();
    if (!content || content.length > 100) return;
    talkMutation.mutate(content);
  }

  function submitVote() {
    if (!selectedVote || voteMutation.isPending || voteCooldownMinutes > 0) return;
    voteMutation.mutate(selectedVote);
  }

  function writeReview() {
    if (!featureFlags.reviewWriting) {
      notify("빵명록 작성 기능은 준비 중이에요.", "info");
      return;
    }
    if (!accessToken || !memberId) {
      openLogin(`/reviews/new?storeId=${store.id}`);
      return;
    }
    router.push(`/reviews/new?storeId=${store.id}`);
  }

  function selectPanelTab(tab: StorePanelTab) {
    setActivePanelTab(tab);
    if (panelContentRef.current) panelContentRef.current.scrollTop = 0;
  }

  async function copyStoreFact(label: "주소" | "전화번호", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify(`${label}를 복사했어요.`, "success");
    } catch {
      notify(`${label}를 복사하지 못했어요.`, "error");
    }
  }

  return (
    <aside className="map-store-panel" data-placement={placement} aria-label={`${store.name} 상세 정보`}>
      <div className="map-store-sticky">
        <div className="map-store-toolbar">
          <div className="map-store-toolbar-main">
            <button type="button" className="map-store-back" onClick={onClose} aria-label="목록으로 돌아가기">
              <ArrowLeft aria-hidden="true" size={21} />
            </button>
            <div className="map-store-toolbar-title">
              <h2>{store.name}</h2>
              <span className={`congestion-pill congestion-${currentLevel.toLowerCase()}`}>
                <i aria-hidden="true" />
                {congestionCopy[currentLevel].shortLabel}
              </span>
            </div>
          </div>
          <div className="map-store-toolbar-actions">
            <button
              type="button"
              className="map-store-favorite"
              aria-label={isFavorite ? "나만의 빵지도에서 삭제" : "나만의 빵지도에 저장"}
              aria-pressed={isFavorite}
              disabled={favoriteMutation.isPending}
              onClick={toggleFavorite}
            >
              <Heart aria-hidden="true" size={20} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        <div className="map-store-summary">
          <div className="map-store-facts">
            <div className="map-store-fact-row">
              <p><MapPin aria-hidden="true" size={16} /> <span>{compactAddress(store.address)}</span></p>
              <button type="button" className="map-store-copy" onClick={() => void copyStoreFact("주소", compactAddress(store.address))} aria-label="주소 복사">
                <Copy aria-hidden="true" size={15} />
              </button>
            </div>
            {store.phoneNumber ? (
              <div className="map-store-fact-row">
                <a href={`tel:${store.phoneNumber}`}><Phone aria-hidden="true" size={16} /> <span>{store.phoneNumber}</span></a>
                <button type="button" className="map-store-copy" onClick={() => void copyStoreFact("전화번호", store.phoneNumber!)} aria-label="전화번호 복사">
                  <Copy aria-hidden="true" size={15} />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="map-store-rating-row"
              onClick={() => selectPanelTab("reviews")}
              aria-label="빵명록 탭으로 이동"
            >
              <span className="map-store-rating-stars" aria-label={rating === null ? "등록된 별점 없음" : `별점 ${rating.toFixed(1)}점`}>
                <span className="map-store-rating-star-row" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={16} />)}
                </span>
                <span className="map-store-rating-filled" style={{ width: `${ratingFillPercentage}%` }} aria-hidden="true">
                  <span className="map-store-rating-star-row">
                    {[1, 2, 3, 4, 5].map((value) => <Star key={value} size={16} fill="currentColor" />)}
                  </span>
                </span>
              </span>
              <span>{rating === null ? "평점 없음" : rating.toFixed(1)} · 빵명록 {reviewCount > 0 ? reviewCount.toLocaleString("ko-KR") : "없음"}</span>
            </button>
          </div>

          <div className="map-store-tabs" role="tablist" aria-label="가게 상세 메뉴">
            <button type="button" role="tab" aria-selected={activePanelTab === "live"} onClick={() => selectPanelTab("live")}>실시간 소식</button>
            <button type="button" role="tab" aria-selected={activePanelTab === "reviews"} onClick={() => selectPanelTab("reviews")}>빵명록 {reviewTabCountLabel}</button>
            <button type="button" role="tab" aria-selected={activePanelTab === "menu"} onClick={() => selectPanelTab("menu")}>메뉴</button>
          </div>
        </div>
      </div>

      <div ref={panelContentRef} className="map-store-content" data-tab={activePanelTab}>
        {activePanelTab === "live" ? (
          <div className="map-store-tab-content map-store-live-tab">
            <section className="map-panel-section map-panel-vote">
              <div className="map-panel-section-title">
                <h3>실시간 혼잡도</h3>
              </div>
              <div className="map-panel-vote-prompt">
                <p>현재 현장 상황은 어때요?</p>
                <small className="map-panel-vote-rules">
                  <span>비회원 참여 가능</span>
                  <span>가게 근처에서만 투표 가능</span>
                  <span>{voteCooldownMinutes > 0
                    ? `${voteCooldownMinutes}분 뒤 투표 가능`
                    : `투표 후 ${CONGESTION_VOTE_COOLDOWN_MINUTES}분 뒤 재투표 가능`}</span>
                </small>
              </div>
              <div className="map-panel-vote-options">
                {congestionLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    data-level={level.toLowerCase()}
                    data-current={currentLevel === level}
                    data-selected={selectedVote === level}
                    aria-pressed={selectedVote === level}
                    disabled={voteMutation.isPending || voteCooldownMinutes > 0}
                    onClick={() => setSelectedVote((current) => current === level ? null : level)}
                  >
                    <span>{currentLevel === level ? <Check aria-hidden="true" size={13} /> : null}{congestionCopy[level].shortLabel}</span>
                    <strong>{voteCounts[level]}표</strong>
                  </button>
                ))}
              </div>
              <button type="button" className="map-panel-submit-vote" disabled={!selectedVote || voteMutation.isPending || voteCooldownMinutes > 0} onClick={submitVote}>
                투표하기
              </button>
            </section>

            <div className="map-panel-talk-divider" aria-hidden="true" />
            <section className="map-panel-section map-panel-talk">
              <div className="map-panel-section-title">
                <h3>실시간 톡</h3>
                <RefreshStatus
                  label="실시간 톡"
                  updatedAt={talksQuery.dataUpdatedAt}
                  isFetching={talksQuery.isFetching}
                  onRefresh={() => void talksQuery.refetch()}
                />
              </div>
              {summary ? (
                <div className="map-store-live">
                  <div><MessageCircleMore aria-hidden="true" size={16} /><strong>AI 요약</strong></div>
                  <p>{summary.summary}</p>
                </div>
              ) : null}
              <div
                ref={talkListRef}
                className="map-panel-talk-list"
                data-empty={talkCount === 0}
                role="log"
                aria-label="실시간 톡 목록"
                aria-live="polite"
                tabIndex={talkCount > 3 ? 0 : undefined}
              >
                {talks.map((talk) => (
                  <article key={talk.id}>
                    <div><strong>{talk.authorNickname}</strong><time>{relativeTime(talk.createdAt)}</time></div>
                    <p>{talk.content}</p>
                  </article>
                ))}
                {talkCount === 0 ? <p className="map-panel-empty">아직 실시간 톡이 없어요.</p> : null}
              </div>
              <form className="map-panel-talk-form" onSubmit={submitTalk}>
                <input value={talkContent} onChange={(event) => setTalkContent(limitTextInput(event.target.value, 100))} maxLength={100} placeholder={accessToken ? "현장 상황을 알려주세요" : "로그인 후 현장 상황을 알려주세요"} />
                <button type="submit" disabled={talkMutation.isPending || talkContent.trim().length === 0} aria-label="실시간 톡 보내기"><Send aria-hidden="true" size={15} /></button>
              </form>
            </section>
          </div>
        ) : null}
        {activePanelTab === "reviews" ? (
          <div className="map-store-tab-content">
            <section className="map-panel-section map-panel-reviews">
              <button type="button" className="map-panel-write-review" onClick={writeReview}>작성하기</button>
              <div className="map-panel-review-list">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    data-review-id={review.id}
                  >
                    <div className="map-panel-review-author">
                      <div className="map-panel-review-identity">
                        <MemberAvatar
                          imageUrl={review.authorProfileImageUrl}
                          className="map-panel-review-avatar"
                        />
                        <strong>{review.authorNickname}</strong>
                      </div>
                    </div>
                    <div className="map-panel-review-rating-row">
                      <span className="map-panel-review-stars" aria-label={`별점 ${review.rating}점`}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            aria-hidden="true"
                            size={15}
                            data-filled={review.rating >= value}
                            fill={review.rating >= value ? "currentColor" : "none"}
                          />
                        ))}
                      </span>
                      <time dateTime={review.createdAt ?? undefined}>{compactReviewDate(review.createdAt)}</time>
                    </div>
                    <p>{review.content}</p>
                    {review.menus.length > 0 ? (
                      <div className="map-panel-review-menus" aria-label="구매 메뉴">
                        {review.menus.map((menu) => <em key={menu}>{menu}</em>)}
                      </div>
                    ) : null}
                    {review.imageUrls.length > 0 ? (
                      <ReviewPhotoGallery imageUrls={review.imageUrls} />
                    ) : null}
                  </article>
                ))}
                {reviews.length === 0 ? <p className="map-panel-empty">첫 빵명록을 기다리고 있어요.</p> : null}
              </div>
            </section>
          </div>
        ) : null}
        {activePanelTab === "menu" ? (
          <div className="map-store-tab-content">
            <section className="map-panel-section map-panel-menus">
              {storeMenus.length > 0 ? (
                <div className="map-panel-menu-list">
                  {storeMenus.map((menu) => (
                    <article key={menu.id}>
                      <div
                        className="map-panel-menu-image"
                        style={menu.imageUrl ? { backgroundImage: `url(${menu.imageUrl})` } : undefined}
                        role={menu.imageUrl ? "img" : undefined}
                        aria-label={menu.imageUrl ? `${menu.name} 사진` : undefined}
                      >
                        {!menu.imageUrl ? <span>사진 준비 중</span> : null}
                      </div>
                      <div className="map-panel-menu-copy">
                        <strong>{menu.name}</strong>
                        <p>{menu.description}</p>
                        <b>{menu.price.toLocaleString("ko-KR")}원</b>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="map-panel-menu-empty">아직 등록된 메뉴가 없어요.</p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

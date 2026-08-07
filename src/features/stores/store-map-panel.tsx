"use client";

import { useState, type FormEvent } from "react";
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
  Send,
  Star,
  X,
} from "lucide-react";
import type { Congestion, CongestionLevel, Store, TalkSummary } from "@/entities/types";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { getCurrentCoordinates } from "@/shared/hooks/use-geolocation";
import {
  averageRating,
  compactAddress,
  congestionCopy,
  relativeTime,
} from "@/shared/lib/format";
import { useFeedback } from "@/shared/ui/feedback-provider";

const congestionLevels: CongestionLevel[] = ["UNCROWDED", "NORMAL", "CROWDED"];

type StoreMapPanelProps = {
  store: Store;
  congestion?: Congestion;
  summary?: TalkSummary;
  placement?: "floating" | "sidebar";
  onClose: () => void;
};

export function StoreMapPanel({ store, congestion, summary, placement = "floating", onClose }: StoreMapPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, memberId } = useAuth();
  const { openLogin } = useLoginModal();
  const { notify } = useFeedback();
  const [talkContent, setTalkContent] = useState("");
  const [selectedVote, setSelectedVote] = useState<CongestionLevel | null>(null);
  const [activePanelTab, setActivePanelTab] = useState<"live" | "reviews">("live");

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
    queryFn: () => bbangbatApi.getFavorites(memberId!, accessToken!),
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
  const rating = averageRating(reviews);
  const reviewImages = reviews.flatMap((review) => review.imageUrls).slice(0, 3);

  const favoriteMutation = useMutation({
    mutationFn: () =>
      isFavorite
        ? bbangbatApi.removeFavorite(store.id, memberId!, accessToken!)
        : bbangbatApi.addFavorite(store.id, memberId!, accessToken!),
    onSuccess: async () => {
      notify(isFavorite ? "나만의 빵지도에서 삭제했어요." : "나만의 빵지도에 저장했어요.", "success");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-stores"] }),
      ]);
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했어요.", "error");
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (level: CongestionLevel) => {
      const coordinates = await getCurrentCoordinates();
      if (!accessToken) await bbangbatApi.issueAnonymousToken();
      return bbangbatApi.voteCongestion(store.id, level, coordinates, accessToken);
    },
    onSuccess: async (nextCongestion) => {
      setSelectedVote(null);
      queryClient.setQueryData(["congestion", store.id], nextCongestion);
      await queryClient.invalidateQueries({ queryKey: ["congestions"] });
      notify("실시간 혼잡도를 알려주셔서 고마워요.", "success");
    },
    onError: (error) => {
      if (!accessToken && error instanceof ApiError && error.status === 401) {
        notify("비회원 투표용 쿠키를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
        return;
      }
      notify(error instanceof Error ? error.message : "혼잡도 투표를 남기지 못했어요.", "error");
    },
  });

  const talkMutation = useMutation({
    mutationFn: (content: string) => bbangbatApi.sendTalk(store.id, content, memberId!, accessToken!),
    onSuccess: async () => {
      setTalkContent("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["talks", store.id] }),
        queryClient.invalidateQueries({ queryKey: ["talk-summaries"] }),
      ]);
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
    favoriteMutation.mutate();
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
    if (!selectedVote || voteMutation.isPending) return;
    voteMutation.mutate(selectedVote);
  }

  function writeReview() {
    if (!accessToken || !memberId) {
      openLogin(`/reviews/new?storeId=${store.id}`);
      return;
    }
    router.push(`/reviews/new?storeId=${store.id}`);
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
      <div className="map-store-toolbar">
        <button type="button" className="map-store-back" onClick={onClose} aria-label="목록으로 돌아가기">
          <ArrowLeft aria-hidden="true" size={21} />
        </button>
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
          <button type="button" className="map-store-close" onClick={onClose} aria-label="상세 닫기">
            <X aria-hidden="true" size={20} />
          </button>
        </div>
      </div>

      <div className="map-store-content">
        <div className="map-store-title">
          <h2>{store.name}</h2>
          <span className={`congestion-pill congestion-${currentLevel.toLowerCase()}`}>
            <i aria-hidden="true" />
            {congestionCopy[currentLevel].shortLabel}
          </span>
        </div>

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
          <p><Star aria-hidden="true" size={16} fill="currentColor" /> {rating ? rating.toFixed(1) : "평점 없음"} · 빵명록 {reviews.length > 0 ? reviews.length : "없음"}</p>
        </div>

        <div className="map-store-tabs" role="tablist" aria-label="가게 상세 메뉴">
          <button type="button" role="tab" aria-selected={activePanelTab === "live"} onClick={() => setActivePanelTab("live")}>실시간 소식</button>
          <button type="button" role="tab" aria-selected={activePanelTab === "reviews"} onClick={() => setActivePanelTab("reviews")}>빵명록</button>
        </div>

        {activePanelTab === "live" ? (
          <div className="map-store-tab-content">
            <section className="map-panel-section map-panel-vote">
              <div className="map-panel-section-title">
                <h3>실시간 혼잡도</h3>
                <button type="button" className="map-panel-submit-vote" disabled={!selectedVote || voteMutation.isPending} onClick={submitVote}>
                  투표하기
                </button>
              </div>
              <div className="map-panel-vote-prompt">
                <p>현재 현장 상태는 어때요?</p>
                <small>비회원 참여 가능 · 15분마다 재투표 가능</small>
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
                    disabled={voteMutation.isPending}
                    onClick={() => setSelectedVote((current) => current === level ? null : level)}
                  >
                    <span>{currentLevel === level ? <Check aria-hidden="true" size={13} /> : null}{congestionCopy[level].shortLabel}</span>
                    <strong>{voteCounts[level]}표</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="map-panel-section map-panel-talk">
              <div className="map-panel-section-title"><h3>실시간 톡</h3></div>
              {summary ? (
                <div className="map-store-live">
                  <div><MessageCircleMore aria-hidden="true" size={16} /><strong>AI 요약</strong></div>
                  <p>{summary.summary}</p>
                </div>
              ) : null}
              <div className="map-panel-talk-list">
                {talksQuery.data?.map((talk) => (
                  <article key={talk.id}>
                    <div><strong>{talk.authorNickname}</strong><time>{relativeTime(talk.createdAt)}</time></div>
                    <p>{talk.content}</p>
                  </article>
                ))}
                {talksQuery.data?.length === 0 ? <p className="map-panel-empty">아직 실시간 톡이 없어요.</p> : null}
              </div>
              <form className="map-panel-talk-form" onSubmit={submitTalk}>
                <input value={talkContent} onChange={(event) => setTalkContent(event.target.value)} maxLength={100} placeholder={accessToken ? "현장 상황을 알려주세요" : "로그인 후 현장 상황을 알려주세요"} />
                <button type="submit" disabled={talkMutation.isPending || talkContent.trim().length === 0} aria-label="실시간 톡 보내기"><Send aria-hidden="true" size={15} /></button>
              </form>
            </section>
          </div>
        ) : (
          <div className="map-store-tab-content">
            <section className="map-panel-section map-panel-reviews">
              <div className="map-panel-section-title">
                <h3>빵명록</h3>
                <button type="button" className="map-panel-write-review" onClick={writeReview}>작성하기</button>
              </div>
              {reviewImages.length > 0 ? (
                <div className="map-store-review-images" aria-label="빵명록 사진">
                  {reviewImages.map((imageUrl) => <div key={imageUrl} style={{ backgroundImage: `url(${imageUrl})` }} />)}
                </div>
              ) : null}
              <div className="map-panel-review-list">
                {reviews.map((review) => (
                  <article key={review.id}>
                    <div><span><Star aria-hidden="true" size={13} fill="currentColor" /> {review.rating.toFixed(1)}</span><time>{relativeTime(review.createdAt)}</time></div>
                    <p>{review.content}</p>
                  </article>
                ))}
                {reviews.length === 0 ? <p className="map-panel-empty">첫 빵명록을 기다리고 있어요.</p> : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}

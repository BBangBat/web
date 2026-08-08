"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Check,
  Heart,
  MapPin,
  MessageCircleMore,
  Phone,
  Send,
  Star,
} from "lucide-react";
import type { CongestionLevel } from "@/entities/types";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import {
  optimisticallySetFavorite,
  rollbackFavoriteCache,
} from "@/features/favorites/favorite-cache";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { ApiError } from "@/shared/api/client";
import { featureFlags } from "@/shared/config/features";
import { getCongestionVoteCoordinates } from "@/shared/hooks/use-geolocation";
import {
  averageRating,
  compactAddress,
  congestionCopy,
  hasStoreImage,
  relativeTime,
} from "@/shared/lib/format";
import { limitTextInput } from "@/shared/lib/text-input";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { ErrorState, LoadingState } from "@/shared/ui/states";

const congestionLevels: CongestionLevel[] = ["UNCROWDED", "NORMAL", "CROWDED"];

export function StoreDetailScreen({ storeId }: { storeId: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, memberId } = useAuth();
  const { openLogin } = useLoginModal();
  const { notify } = useFeedback();
  const [talkContent, setTalkContent] = useState("");

  const storeQuery = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => bbangbatApi.getStore(storeId),
  });
  const congestionQuery = useQuery({
    queryKey: ["congestion", storeId],
    queryFn: () => bbangbatApi.getCongestion(storeId),
    refetchInterval: 60_000,
  });
  const talksQuery = useQuery({
    queryKey: ["talks", storeId],
    queryFn: () => bbangbatApi.getTalks(storeId),
    refetchInterval: 20_000,
  });
  const summaryQuery = useQuery({
    queryKey: ["talk-summary", storeId],
    queryFn: async () => (await bbangbatApi.getTalkSummaries([storeId]))[0] ?? null,
    refetchInterval: 60_000,
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews", storeId],
    queryFn: () => bbangbatApi.getReviews(storeId),
  });
  const favoritesQuery = useQuery({
    queryKey: ["favorites", memberId],
    queryFn: () => bbangbatApi.getFavorites(memberId!, accessToken!),
    enabled: Boolean(accessToken && memberId),
  });

  const isFavorite = favoritesQuery.data?.includes(storeId) ?? false;
  const rating = averageRating(reviewsQuery.data ?? []);

  const favoriteMutation = useMutation({
    mutationFn: async (nextFavorite: boolean) => {
      if (!accessToken || !memberId) throw new ApiError(401, { message: "로그인이 필요해요." });
      return nextFavorite
        ? bbangbatApi.addFavorite(storeId, memberId, accessToken)
        : bbangbatApi.removeFavorite(storeId, memberId, accessToken);
    },
    onMutate: (nextFavorite) =>
      storeQuery.data && memberId
        ? optimisticallySetFavorite(queryClient, memberId, storeQuery.data, nextFavorite)
        : undefined,
    onSuccess: (_data, nextFavorite) => {
      notify(nextFavorite ? "나만의 빵지도에 저장했어요." : "나만의 빵지도에서 삭제했어요.", "success");
    },
    onError: (error, _nextFavorite, snapshot) => {
      if (memberId) rollbackFavoriteCache(queryClient, memberId, snapshot);
      if (error instanceof ApiError && error.status === 401) {
        openLogin(`/stores/${storeId}`);
        return;
      }
      notify(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했어요.", "error");
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-stores"] }),
      ]);
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (level: CongestionLevel) => {
      const location = await getCongestionVoteCoordinates({
        developmentCoordinates: storeQuery.data,
      });
      if (!accessToken) await bbangbatApi.issueAnonymousToken();
      return bbangbatApi.voteCongestion(storeId, level, location, accessToken);
    },
    onSuccess: (congestion) => {
      queryClient.setQueryData(["congestion", storeId], congestion);
      notify("지금 현장을 알려주셔서 고마워요!", "success");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "CONGESTION_VOTE_COOLDOWN") {
        const remainingMinutes = error.retryAfterSeconds === undefined
          ? null
          : Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
        notify(
          remainingMinutes === null
            ? error.message
            : `${remainingMinutes}분 뒤 다시 투표할 수 있어요.`,
          "info",
        );
        return;
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
      notify(error instanceof Error ? error.message : "투표를 남기지 못했어요.", "error");
    },
  });

  const talkMutation = useMutation({
    mutationFn: (content: string) => {
      if (!accessToken || !memberId) throw new ApiError(401, { message: "톡 작성은 로그인이 필요해요." });
      return bbangbatApi.sendTalk(storeId, content, memberId, accessToken);
    },
    onSuccess: async () => {
      setTalkContent("");
      await queryClient.invalidateQueries({ queryKey: ["talks", storeId] });
      notify("톡을 남겼어요.", "success");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        openLogin(`/stores/${storeId}`);
        return;
      }
      notify(error instanceof Error ? error.message : "톡을 보내지 못했어요.", "error");
    },
  });

  function submitTalk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = talkContent.trim();
    if (content.length === 0 || content.length > 100) return;
    talkMutation.mutate(content);
  }

  function writeReview() {
    if (!featureFlags.reviewWriting) {
      notify("빵명록 작성 기능은 준비 중이에요.", "info");
      return;
    }
    if (!accessToken || !memberId) {
      openLogin(`/reviews/new?storeId=${storeId}`);
      return;
    }
    router.push(`/reviews/new?storeId=${storeId}`);
  }

  const reviewImages = useMemo(
    () => (reviewsQuery.data ?? []).flatMap((review) => review.imageUrls).slice(0, 4),
    [reviewsQuery.data],
  );

  if (storeQuery.isLoading) return <LoadingState label="빵집 정보를 가져오는 중" />;
  if (storeQuery.isError || !storeQuery.data) {
    return <ErrorState onRetry={() => void storeQuery.refetch()} />;
  }

  const store = storeQuery.data;
  const hasCustomImage = hasStoreImage(store.imageUrl);
  const congestion = congestionQuery.data;

  return (
    <main className="detail-page">
      <div
        className="store-hero"
        style={hasCustomImage ? { backgroundImage: `url(${store.imageUrl})` } : undefined}
      >
        <div className="store-hero-overlay" />
        <div className="detail-top-actions">
          <button type="button" onClick={() => router.back()} aria-label="이전 페이지">
            <ArrowLeft aria-hidden="true" size={21} />
          </button>
          <button
            type="button"
            onClick={() => favoriteMutation.mutate(!isFavorite)}
            aria-label={isFavorite ? "나만의 빵지도에서 삭제" : "나만의 빵지도에 저장"}
            aria-pressed={isFavorite}
            disabled={favoriteMutation.isPending}
          >
            <Heart aria-hidden="true" size={21} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
        {!hasCustomImage ? (
          <div className="hero-placeholder" aria-hidden="true">
            <span>BAKERY</span>
            <strong>오늘의 빵을 만나는 곳</strong>
          </div>
        ) : null}
      </div>

      <div className="detail-content">
        <section className="store-overview">
          <div className="store-title-row">
            <div>
              <p className="eyebrow">DAEJEON BAKERY</p>
              <h1>{store.name}</h1>
            </div>
            <span className={`congestion-pill congestion-${(congestion?.current ?? "UNCROWDED").toLowerCase()}`}>
              <i aria-hidden="true" />
              {congestionCopy[congestion?.current ?? "UNCROWDED"].label}
            </span>
          </div>
          <div className="store-facts">
            <p><MapPin aria-hidden="true" size={17} /> {compactAddress(store.address)}</p>
            {store.phoneNumber ? (
              <a href={`tel:${store.phoneNumber}`}><Phone aria-hidden="true" size={17} /> {store.phoneNumber}</a>
            ) : null}
            <p><Star aria-hidden="true" size={17} fill="currentColor" /> {rating ? rating.toFixed(1) : "첫 기록을 기다려요"} · 빵명록 {reviewsQuery.data?.length ? reviewsQuery.data.length : "없음"}</p>
          </div>
        </section>

        <div className="detail-grid">
          <div className="detail-main-column">
            <section className="detail-section congestion-section">
              <div className="section-heading">
                <div><span>LIVE</span><h2>지금 가게는 어때요?</h2></div>
                <small>최근 15분 · {congestion?.totalVotes ?? 0}명 참여</small>
              </div>
              <div className="congestion-options">
                {congestionLevels.map((level) => {
                  const voteCount =
                    level === "UNCROWDED"
                      ? congestion?.uncrowdedVotes
                      : level === "NORMAL"
                        ? congestion?.normalVotes
                        : congestion?.crowdedVotes;
                  return (
                    <button
                      key={level}
                      type="button"
                      className={`congestion-option congestion-${level.toLowerCase()}`}
                      data-current={congestion?.current === level}
                      disabled={voteMutation.isPending}
                      onClick={() => voteMutation.mutate(level)}
                    >
                      <i aria-hidden="true" />
                      <strong>{congestionCopy[level].label}</strong>
                      <span>{voteCount ?? 0}표</span>
                      {congestion?.current === level ? <Check aria-hidden="true" size={15} /> : null}
                    </button>
                  );
                })}
              </div>
              <p className="location-note">가게 반경 200m 안에서 참여할 수 있어요. 제보는 60분 후 사라져요.</p>
            </section>

            <section className="detail-section talk-section">
              <div className="section-heading">
                <div><MessageCircleMore aria-hidden="true" size={20} /><h2>실시간 톡</h2></div>
                <small>최근 24시간</small>
              </div>
              {summaryQuery.data ? (
                <div className="ai-summary">
                  <Bot aria-hidden="true" size={20} />
                  <div><span>AI가 방금 요약했어요</span><strong>{summaryQuery.data.summary}</strong></div>
                </div>
              ) : null}
              <div className="talk-list">
                {talksQuery.data?.length ? (
                  talksQuery.data.slice(-12).map((talk) => (
                    <article key={talk.id}>
                      <div><strong>{talk.authorNickname}</strong><time>{relativeTime(talk.createdAt)}</time></div>
                      <p>{talk.content}</p>
                    </article>
                  ))
                ) : (
                  <p className="section-empty">아직 톡이 없어요. 오늘의 첫 소식을 알려주세요.</p>
                )}
              </div>
              <form className="talk-form" onSubmit={submitTalk}>
                <input
                  value={talkContent}
                  onChange={(event) => setTalkContent(limitTextInput(event.target.value, 100))}
                  maxLength={100}
                  placeholder={accessToken ? "현장 상황을 알려주세요" : "로그인 후 현장 상황을 알려주세요"}
                  aria-label="실시간 톡 내용"
                />
                <span>{talkContent.length}/100</span>
                <button type="submit" disabled={talkMutation.isPending || !talkContent.trim()} aria-label="톡 보내기">
                  <Send aria-hidden="true" size={18} />
                </button>
              </form>
            </section>

            <section className="detail-section reviews-section">
              <div className="section-heading">
                <div><Star aria-hidden="true" size={20} /><h2>빵명록</h2></div>
                <button type="button" onClick={writeReview}>작성하기</button>
              </div>
              {reviewImages.length > 0 ? (
                <div className="review-image-strip">
                  {reviewImages.map((imageUrl) => (
                    <div key={imageUrl} style={{ backgroundImage: `url(${imageUrl})` }} aria-label="빵명록 사진" />
                  ))}
                </div>
              ) : null}
              <div className="review-list">
                {reviewsQuery.data?.length ? (
                  reviewsQuery.data.map((review) => (
                    <article key={review.id}>
                      <header>
                        <div className="review-avatar" aria-hidden="true">빵</div>
                        <div><strong>빵친구 {review.memberId}</strong><span>{relativeTime(review.createdAt)}</span></div>
                        <p><Star aria-hidden="true" size={14} fill="currentColor" /> {review.rating.toFixed(1)}</p>
                      </header>
                      <div className="menu-tags">{review.menus.map((menu) => <span key={menu}>{menu}</span>)}</div>
                      <p>{review.content}</p>
                    </article>
                  ))
                ) : (
                  <div className="section-empty">
                    <p>아직 빵명록이 없어요.</p>
                    <button type="button" className="button button-primary button-small" onClick={writeReview}>첫 빵명록 남기기</button>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="detail-aside">
            <div className="aside-card">
              <span>이 빵집이 마음에 드나요?</span>
              <h2>나만의 빵지도에<br />저장해 두세요.</h2>
              <button type="button" className="button button-primary" disabled={favoriteMutation.isPending} onClick={() => favoriteMutation.mutate(!isFavorite)}>
                <Heart aria-hidden="true" size={17} fill={isFavorite ? "currentColor" : "none"} />
                {isFavorite ? "저장됨" : "나만의 빵지도에 저장"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

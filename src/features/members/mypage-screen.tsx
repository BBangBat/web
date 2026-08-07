"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Heart,
  LogOut,
  MessageCircleMore,
  NotebookText,
  Settings,
  Star,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { relativeTime } from "@/shared/lib/format";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { LoadingState } from "@/shared/ui/states";

type MypageTab = "overview" | "reviews";

export function MypageScreen({ initialTab }: { initialTab: MypageTab }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, memberId, member, status, logout } = useAuth();
  const { openLogin } = useLoginModal();
  const { notify } = useFeedback();
  const statsQuery = useQuery({
    queryKey: ["member-stats", memberId],
    queryFn: () => bbangbatApi.getMemberStats(memberId!, accessToken!),
    enabled: Boolean(accessToken && memberId),
  });
  const reviewsQuery = useQuery({
    queryKey: ["my-reviews", memberId],
    queryFn: () => bbangbatApi.getMyReviews(memberId!, accessToken!),
    enabled: Boolean(accessToken && memberId) && initialTab === "reviews",
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewId: number) => bbangbatApi.deleteReview(reviewId, memberId!, accessToken!),
    onSuccess: async () => {
      notify("빵명록을 삭제했어요.", "success");
      await queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
      await queryClient.invalidateQueries({ queryKey: ["member-stats"] });
    },
    onError: (error) => notify(error instanceof Error ? error.message : "삭제하지 못했어요.", "error"),
  });

  if (status === "initializing") return <LoadingState label="내 빵밭을 여는 중" />;

  if (status === "anonymous") {
    return (
      <main className="center-page">
        <div className="login-required-card">
          <UserRound aria-hidden="true" size={32} />
          <h1>로그인하고 내 빵밭을 가꿔보세요.</h1>
          <p>나만의 빵지도, 빵명록, 실시간 톡 활동을 한곳에서 볼 수 있어요.</p>
          <button type="button" className="button button-primary" onClick={() => openLogin("/mypage")}>로그인하기</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mypage">
      <section className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {member?.profileImageUrl ? (
            <span style={{ backgroundImage: `url(${member.profileImageUrl})` }} />
          ) : (
            member?.nickname.slice(0, 1)
          )}
        </div>
        <div>
          <p className="eyebrow">MY BBANGBAT</p>
          <h1>{member?.nickname}님의 빵밭</h1>
          <p>{member?.email}</p>
        </div>
      </section>

      <section className="stats-grid" aria-label="내 활동 통계">
        <Link href="/mypage?tab=reviews"><NotebookText aria-hidden="true" size={20} /><strong>{statsQuery.data?.reviewCount ?? 0}</strong><span>빵명록</span></Link>
        <Link href="/favorites"><Heart aria-hidden="true" size={20} /><strong>{statsQuery.data?.favoriteCount ?? 0}</strong><span>나만의 빵지도</span></Link>
        <div><MessageCircleMore aria-hidden="true" size={20} /><strong>{statsQuery.data?.talkCount ?? 0}</strong><span>실시간 톡</span></div>
      </section>

      <div className="mypage-layout">
        <nav className="mypage-tabs" aria-label="마이페이지 메뉴">
          <Link href="/mypage" data-active={initialTab === "overview"}>내 정보</Link>
          <Link href="/mypage?tab=reviews" data-active={initialTab === "reviews"}>내 빵명록</Link>
        </nav>

        {initialTab === "reviews" ? (
          <section className="my-reviews">
            <div className="mypage-section-heading"><div><p className="eyebrow">BREAD NOTES</p><h2>내 빵명록</h2></div><span>{reviewsQuery.data?.length ?? 0}개의 기록</span></div>
            {reviewsQuery.isLoading ? <LoadingState label="빵명록을 펼치는 중" /> : null}
            {reviewsQuery.data?.length === 0 ? (
              <div className="mypage-empty"><NotebookText aria-hidden="true" size={27} /><strong>아직 남긴 빵명록이 없어요.</strong><Link href="/">빵집 둘러보기</Link></div>
            ) : null}
            <div className="my-review-grid">
              {reviewsQuery.data?.map((review) => (
                <article key={review.id}>
                  <Link href={`/stores/${review.storeId}`} className="my-review-store">
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
        ) : (
          <section className="account-overview">
            <div className="mypage-section-heading"><div><p className="eyebrow">ACCOUNT</p><h2>내 정보</h2></div></div>
            <div className="account-card">
              <div><span>이름</span><strong>{member?.name}</strong></div>
              <div><span>닉네임</span><strong>{member?.nickname}</strong></div>
              <div><span>이메일</span><strong>{member?.email}</strong></div>
            </div>
            <button type="button" className="account-menu" disabled><Settings aria-hidden="true" size={19} /><span><strong>프로필 설정</strong><small>프로필 수정 API 준비 후 연결됩니다.</small></span><ChevronRight aria-hidden="true" size={18} /></button>
            <button
              type="button"
              className="account-menu account-logout"
              onClick={() => void logout().then(() => router.replace("/"))}
            >
              <LogOut aria-hidden="true" size={19} /><span><strong>로그아웃</strong></span><ChevronRight aria-hidden="true" size={18} />
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

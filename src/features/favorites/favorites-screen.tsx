"use client";

import { useQuery } from "@tanstack/react-query";
import { Heart, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { StoreCard } from "@/features/stores/store-card";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";

export function FavoritesScreen() {
  const { accessToken, memberId, status } = useAuth();
  const { openLogin } = useLoginModal();
  const favoriteIdsQuery = useQuery({
    queryKey: ["favorites", memberId],
    queryFn: () => bbangbatApi.getFavorites(memberId!, accessToken!),
    enabled: Boolean(accessToken && memberId),
  });
  const favoriteStoresQuery = useQuery({
    queryKey: ["favorite-stores", memberId, favoriteIdsQuery.data],
    queryFn: () => bbangbatApi.getStoresBulk(favoriteIdsQuery.data ?? []),
    enabled: Boolean(accessToken && memberId && favoriteIdsQuery.isSuccess),
  });

  if (status === "initializing") return <LoadingState label="나만의 빵지도를 여는 중" />;
  if (status === "anonymous") {
    return (
      <main className="center-page">
        <div className="login-required-card">
          <UserRound aria-hidden="true" size={32} />
          <h1>나만의 빵지도는 로그인 후 볼 수 있어요.</h1>
          <p>다시 가고 싶은 빵집을 즐겨찾기에 모아보세요.</p>
          <button type="button" className="button button-primary" onClick={() => openLogin("/favorites")}>로그인하기</button>
        </div>
      </main>
    );
  }

  return (
    <main className="collection-page">
      <header className="collection-header">
        <div><p className="eyebrow">MY BAKERY MAP</p><h1>나만의 빵지도</h1><p>즐겨찾기로 저장한 대전의 빵집이에요.</p></div>
        <Heart aria-hidden="true" size={42} />
      </header>
      {favoriteIdsQuery.isLoading || favoriteStoresQuery.isLoading ? <LoadingState label="나만의 빵지도를 불러오는 중" /> : null}
      {favoriteIdsQuery.isError || favoriteStoresQuery.isError ? (
        <ErrorState onRetry={() => void Promise.all([favoriteIdsQuery.refetch(), favoriteStoresQuery.refetch()])} />
      ) : null}
      {favoriteStoresQuery.data?.length === 0 ? (
        <EmptyState title="아직 저장한 빵집이 없어요" description="빵집 상세에서 하트를 눌러 나만의 빵지도를 채워보세요." />
      ) : null}
      <div className="collection-grid">
        {favoriteStoresQuery.data?.map((store) => <StoreCard key={store.id} store={store} />)}
      </div>
    </main>
  );
}

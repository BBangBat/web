import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { MemberStats, Store } from "@/entities/types";

type FavoriteStoreQuerySnapshot = [QueryKey, Store[] | undefined];

export type FavoriteCacheSnapshot = {
  favoriteIds: number[] | undefined;
  memberStats: MemberStats | undefined;
  storeQueries: FavoriteStoreQuerySnapshot[];
};

export function withFavoriteState(
  favoriteIds: number[],
  storeId: number,
  nextFavorite: boolean,
) {
  if (nextFavorite) return favoriteIds.includes(storeId) ? favoriteIds : [storeId, ...favoriteIds];
  return favoriteIds.filter((favoriteId) => favoriteId !== storeId);
}

function withFavoriteStoreState(
  stores: Store[] | undefined,
  store: Store,
  nextFavorite: boolean,
) {
  if (!stores) return stores;
  if (nextFavorite) return stores.some((item) => item.id === store.id) ? stores : [store, ...stores];
  return stores.filter((item) => item.id !== store.id);
}

export async function optimisticallySetFavorite(
  queryClient: QueryClient,
  memberId: string,
  store: Store,
  nextFavorite: boolean,
  knownStores: Store[] = [],
): Promise<FavoriteCacheSnapshot> {
  const favoriteIdsKey = ["favorites", memberId] as const;
  const favoriteStoresKey = ["favorite-stores", memberId] as const;
  const memberStatsKey = ["member-stats", memberId] as const;

  await Promise.all([
    queryClient.cancelQueries({ queryKey: favoriteIdsKey, exact: true }),
    queryClient.cancelQueries({ queryKey: favoriteStoresKey }),
    queryClient.cancelQueries({ queryKey: memberStatsKey, exact: true }),
  ]);

  const favoriteIds = queryClient.getQueryData<number[]>(favoriteIdsKey);
  const memberStats = queryClient.getQueryData<MemberStats>(memberStatsKey);
  const storeQueries = queryClient.getQueriesData<Store[]>({ queryKey: favoriteStoresKey });
  const nextFavoriteIds = withFavoriteState(favoriteIds ?? [], store.id, nextFavorite);

  queryClient.setQueryData(favoriteIdsKey, nextFavoriteIds);
  if (memberStats) {
    const wasFavorite = favoriteIds?.includes(store.id) ?? !nextFavorite;
    if (wasFavorite !== nextFavorite) {
      queryClient.setQueryData<MemberStats>(memberStatsKey, {
        ...memberStats,
        favoriteCount: Math.max(0, memberStats.favoriteCount + (nextFavorite ? 1 : -1)),
      });
    }
  }
  for (const [queryKey, stores] of storeQueries) {
    queryClient.setQueryData(queryKey, withFavoriteStoreState(stores, store, nextFavorite));
  }

  const knownStoreById = new Map<number, Store>();
  for (const [, stores] of storeQueries) {
    for (const knownStore of stores ?? []) knownStoreById.set(knownStore.id, knownStore);
  }
  for (const knownStore of knownStores) knownStoreById.set(knownStore.id, knownStore);
  knownStoreById.set(store.id, store);
  const nextFavoriteStores = nextFavoriteIds
    .map((favoriteId) => knownStoreById.get(favoriteId))
    .filter((favoriteStore): favoriteStore is Store => Boolean(favoriteStore));

  if (nextFavoriteStores.length === nextFavoriteIds.length) {
    queryClient.setQueryData(
      ["favorite-stores", memberId, nextFavoriteIds],
      nextFavoriteStores,
    );
  }

  return { favoriteIds, memberStats, storeQueries };
}

export function rollbackFavoriteCache(
  queryClient: QueryClient,
  memberId: string,
  snapshot: FavoriteCacheSnapshot | undefined,
) {
  if (!snapshot) return;
  queryClient.setQueryData(["favorites", memberId], snapshot.favoriteIds);
  queryClient.setQueryData(["member-stats", memberId], snapshot.memberStats);
  for (const [queryKey, stores] of snapshot.storeQueries) {
    queryClient.setQueryData(queryKey, stores);
  }
}

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { Store } from "@/entities/types";

type FavoriteStoreQuerySnapshot = [QueryKey, Store[] | undefined];

export type FavoriteCacheSnapshot = {
  favoriteIds: number[] | undefined;
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

  await Promise.all([
    queryClient.cancelQueries({ queryKey: favoriteIdsKey, exact: true }),
    queryClient.cancelQueries({ queryKey: favoriteStoresKey }),
  ]);

  const favoriteIds = queryClient.getQueryData<number[]>(favoriteIdsKey);
  const storeQueries = queryClient.getQueriesData<Store[]>({ queryKey: favoriteStoresKey });
  const nextFavoriteIds = withFavoriteState(favoriteIds ?? [], store.id, nextFavorite);

  queryClient.setQueryData(favoriteIdsKey, nextFavoriteIds);
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

  return { favoriteIds, storeQueries };
}

export function rollbackFavoriteCache(
  queryClient: QueryClient,
  memberId: string,
  snapshot: FavoriteCacheSnapshot | undefined,
) {
  if (!snapshot) return;
  queryClient.setQueryData(["favorites", memberId], snapshot.favoriteIds);
  for (const [queryKey, stores] of snapshot.storeQueries) {
    queryClient.setQueryData(queryKey, stores);
  }
}

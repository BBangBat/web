import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { Store } from "@/entities/types";
import {
  optimisticallySetFavorite,
  rollbackFavoriteCache,
} from "@/features/favorites/favorite-cache";

const store = {
  id: 2,
  name: "테스트 빵집",
  address: "대전광역시",
  latitude: 36.35,
  longitude: 127.38,
} as Store;

describe("favorite cache", () => {
  it("서버 응답 전에 즐겨찾기 ID와 가게 목록을 함께 갱신한다", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["favorites", "1"], [1]);
    queryClient.setQueryData<Store[]>(["favorite-stores", "1"], []);

    await optimisticallySetFavorite(queryClient, "1", store, true);

    expect(queryClient.getQueryData(["favorites", "1"])).toEqual([2, 1]);
    expect(queryClient.getQueryData<Store[]>(["favorite-stores", "1"])).toEqual([store]);
  });

  it("요청 실패 시 이전 즐겨찾기 캐시로 복구한다", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["favorites", "1"], [2]);
    queryClient.setQueryData<Store[]>(["favorite-stores", "1"], [store]);

    const snapshot = await optimisticallySetFavorite(queryClient, "1", store, false);
    expect(queryClient.getQueryData(["favorites", "1"])).toEqual([]);
    expect(queryClient.getQueryData<Store[]>(["favorite-stores", "1"])).toEqual([]);

    rollbackFavoriteCache(queryClient, "1", snapshot);

    expect(queryClient.getQueryData(["favorites", "1"])).toEqual([2]);
    expect(queryClient.getQueryData<Store[]>(["favorite-stores", "1"])).toEqual([store]);
  });
});

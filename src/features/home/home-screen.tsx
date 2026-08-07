"use client";

import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MapPin, Search, X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { useLoginModal } from "@/features/auth/login-modal";
import { BakeryMap, type MapViewport } from "@/features/map/bakery-map";
import { StoreCard } from "@/features/stores/store-card";
import { StoreMapPanel } from "@/features/stores/store-map-panel";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { useGeolocation } from "@/shared/hooks/use-geolocation";
import { DEFAULT_LOCATION, distanceInKm, isWithinDaejeon } from "@/shared/lib/format";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";

type SheetSnap = "collapsed" | "half" | "expanded";
type SidebarTab = "nearby" | "favorites";

const sheetSnaps: SheetSnap[] = ["expanded", "half", "collapsed"];
const COLLAPSED_SHEET_HEIGHT = 270;

export function HomeScreen() {
  const queryClient = useQueryClient();
  const { accessToken, memberId, status: authStatus } = useAuth();
  const { openLogin } = useLoginModal();
  const { location, status: locationStatus, requestLocation } = useGeolocation();
  const { notify } = useFeedback();
  const [activeTab, setActiveTab] = useState<SidebarTab>("nearby");
  const [query, setQuery] = useState("");
  const [mapCenter, setMapCenter] = useState(DEFAULT_LOCATION);
  const [viewportCenter, setViewportCenter] = useState(DEFAULT_LOCATION);
  const [areaSearchLocation, setAreaSearchLocation] = useState(DEFAULT_LOCATION);
  const [mapFocus, setMapFocus] = useState({
    id: 0,
    center: DEFAULT_LOCATION,
    level: 5,
    offsetForPanel: false,
  });
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("collapsed");
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [detailPlacement, setDetailPlacement] = useState<"floating" | "sidebar">("floating");
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; baseY: number } | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  const storesQuery = useQuery({
    queryKey: [
      "stores",
      areaSearchLocation.latitude.toFixed(4),
      areaSearchLocation.longitude.toFixed(4),
    ],
    queryFn: () => bbangbatApi.getStores(areaSearchLocation),
    placeholderData: (previousData) => previousData,
  });
  const favoriteIdsQuery = useQuery({
    queryKey: ["favorites", memberId],
    queryFn: () => bbangbatApi.getFavorites(memberId!, accessToken!),
    enabled: Boolean(accessToken && memberId),
  });
  const favoriteStoresQuery = useQuery({
    queryKey: ["favorite-stores", memberId, favoriteIdsQuery.data],
    queryFn: () => Promise.all((favoriteIdsQuery.data ?? []).map((storeId) => bbangbatApi.getStore(storeId))),
    enabled: activeTab === "favorites" && Boolean(accessToken) && favoriteIdsQuery.isSuccess,
  });

  const nearbyStores = useMemo(
    () =>
      [...(storesQuery.data ?? [])].sort(
        (a, b) => distanceInKm(areaSearchLocation, a) - distanceInKm(areaSearchLocation, b),
      ),
    [areaSearchLocation, storesQuery.data],
  );
  const favoriteStores = useMemo(
    () => favoriteStoresQuery.data ?? [],
    [favoriteStoresQuery.data],
  );
  const favoriteIds = useMemo(
    () => new Set(favoriteIdsQuery.data ?? []),
    [favoriteIdsQuery.data],
  );
  const activeStores = activeTab === "nearby" ? nearbyStores : favoriteStores;
  const allKnownStores = useMemo(
    () => [...nearbyStores, ...favoriteStores],
    [favoriteStores, nearbyStores],
  );
  const activeStoreIds = useMemo(() => activeStores.map((store) => store.id), [activeStores]);

  const congestionsQuery = useQuery({
    queryKey: ["congestions", activeStoreIds],
    queryFn: () => bbangbatApi.getCongestions(activeStoreIds),
    enabled: activeStoreIds.length > 0,
    refetchInterval: 60_000,
  });
  const summariesQuery = useQuery({
    queryKey: ["talk-summaries", activeStoreIds],
    queryFn: () => bbangbatApi.getTalkSummaries(activeStoreIds),
    enabled: activeStoreIds.length > 0,
    refetchInterval: 60_000,
  });
  const searchQuery = useQuery({
    queryKey: ["store-search", deferredQuery],
    queryFn: () => bbangbatApi.searchStores(deferredQuery),
    enabled: deferredQuery.length >= 2,
    staleTime: 5 * 60_000,
  });

  const knownSelectedStore =
    allKnownStores.find((store) => store.id === selectedStoreId) ?? null;
  const selectedStoreQuery = useQuery({
    queryKey: ["store", selectedStoreId],
    queryFn: () => bbangbatApi.getStore(selectedStoreId!),
    enabled: Boolean(selectedStoreId) && !knownSelectedStore,
  });
  const selectedStore = knownSelectedStore ?? selectedStoreQuery.data ?? null;

  const congestionByStore = useMemo(
    () => new Map((congestionsQuery.data ?? []).map((item) => [item.storeId, item])),
    [congestionsQuery.data],
  );
  const summaryByStore = useMemo(
    () => new Map((summariesQuery.data ?? []).map((item) => [item.storeId, item])),
    [summariesQuery.data],
  );

  const visibleStores = activeStores;
  const mapStores = useMemo(() => {
    const stores = new Map<number, (typeof nearbyStores)[number]>();
    for (const store of nearbyStores) stores.set(store.id, store);
    if (selectedStore) stores.set(selectedStore.id, selectedStore);
    return [...stores.values()];
  }, [nearbyStores, selectedStore]);

  const favoriteMutation = useMutation({
    mutationFn: ({ storeId, favorite }: { storeId: number; favorite: boolean }) =>
      favorite
        ? bbangbatApi.removeFavorite(storeId, memberId!, accessToken!)
        : bbangbatApi.addFavorite(storeId, memberId!, accessToken!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-stores"] }),
      ]);
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했어요.", "error");
    },
  });

  function sheetBasePosition(snap: SheetSnap, height: number): number {
    if (snap === "expanded") return 0;
    if (snap === "half") return height * 0.4;
    return Math.max(0, height - COLLAPSED_SHEET_HEIGHT);
  }

  function startSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const height = sheetRef.current?.offsetHeight ?? 0;
    dragRef.current = {
      startY: event.clientY,
      baseY: sheetBasePosition(sheetSnap, height),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSheet(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const height = sheetRef.current?.offsetHeight ?? 0;
    if (!drag || !height) return;
    setDragPosition(
      Math.min(
        height - COLLAPSED_SHEET_HEIGHT,
        Math.max(0, drag.baseY + event.clientY - drag.startY),
      ),
    );
  }

  function endSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientY - drag.startY;
    const currentIndex = sheetSnaps.indexOf(sheetSnap);

    if (delta > 55) {
      setSheetSnap(sheetSnaps[Math.min(sheetSnaps.length - 1, currentIndex + 1)] ?? "collapsed");
    } else if (delta < -55) {
      setSheetSnap(sheetSnaps[Math.max(0, currentIndex - 1)] ?? "expanded");
    } else if (Math.abs(delta) < 8) {
      setSheetSnap(sheetSnap === "collapsed" ? "half" : sheetSnap === "half" ? "expanded" : "collapsed");
    }

    dragRef.current = null;
    setDragPosition(null);
  }

  async function locateUser() {
    setSelectedStoreId(null);
    setSheetSnap("collapsed");
    try {
      const coordinates = await requestLocation();
      if (isWithinDaejeon(coordinates)) {
        focusMap(coordinates, 4);
        setAreaSearchLocation(coordinates);
        notify("현재 위치로 이동했어요.", "success");
      } else {
        focusMap(DEFAULT_LOCATION, 4);
        setAreaSearchLocation(DEFAULT_LOCATION);
        notify("현재 위치가 대전 밖이라 대전 기본 위치로 이동했어요.", "info");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "현재 위치를 확인하지 못했어요.", "error");
    }
  }

  function focusMap(center: typeof DEFAULT_LOCATION, level: number, offsetForPanel = false) {
    setMapCenter(center);
    setViewportCenter(center);
    setMapFocus((current) => ({ id: current.id + 1, center, level, offsetForPanel }));
  }

  function selectStore(storeId: number) {
    setDetailPlacement("floating");
    setSelectedStoreId(storeId);
    setSheetSnap("collapsed");
    const store = allKnownStores.find((item) => item.id === storeId);
    if (store) focusMap(store, 3, true);
  }

  async function selectSearchResult(storeId: number) {
    try {
      const store = await queryClient.fetchQuery({
        queryKey: ["store", storeId],
        queryFn: () => bbangbatApi.getStore(storeId),
      });
      setDetailPlacement("sidebar");
      setSelectedStoreId(storeId);
      setSheetSnap("collapsed");
      setQuery("");
      focusMap(store, 3);
    } catch (error) {
      notify(error instanceof Error ? error.message : "빵집 정보를 불러오지 못했어요.", "error");
    }
  }

  function searchCurrentArea() {
    setActiveTab("nearby");
    setSelectedStoreId(null);
    setQuery("");
    const locationChanged = distanceInKm(areaSearchLocation, viewportCenter) >= 0.01;
    setAreaSearchLocation(viewportCenter);
    setMapCenter(viewportCenter);
    if (!locationChanged) void storesQuery.refetch();
  }

  function updateViewport(nextViewport: MapViewport) {
    setViewportCenter(nextViewport.center);
  }

  function changeTab(tab: SidebarTab) {
    setActiveTab(tab);
    setQuery("");
    setSelectedStoreId(null);
    setSheetSnap("collapsed");
  }

  function toggleFavorite(storeId: number) {
    if (!accessToken) {
      openLogin("/");
      return;
    }
    favoriteMutation.mutate({ storeId, favorite: favoriteIds.has(storeId) });
  }

  const listLoading =
    activeTab === "nearby"
      ? storesQuery.isLoading
      : authStatus === "initializing" || favoriteIdsQuery.isLoading || favoriteStoresQuery.isLoading;
  const listError = activeTab === "nearby" ? storesQuery.isError : favoriteStoresQuery.isError;

  return (
    <main className="home-shell" data-detail-open={Boolean(selectedStore)} data-detail-placement={detailPlacement}>
      <section className="explore-panel" data-searching={query.trim().length > 0} aria-label="빵집 탐색">
        <div className="search-box">
          <Search aria-hidden="true" size={19} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="빵집 이름을 검색해 보세요"
            aria-label="빵집 검색"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">
              <X aria-hidden="true" size={17} />
            </button>
          ) : null}
          {deferredQuery.length >= 2 ? (
            <div className="search-results">
              {searchQuery.isLoading ? <span>찾는 중…</span> : null}
              {searchQuery.data?.slice(0, 6).map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => void selectSearchResult(result.id)}
                >
                  <strong>{result.name}</strong>
                  <small>{result.address}</small>
                </button>
              ))}
              {searchQuery.data?.length === 0 ? <span>검색 결과가 없어요.</span> : null}
            </div>
          ) : null}
        </div>

        <div
          ref={sheetRef}
          className={`mobile-bottom-sheet sheet-${sheetSnap}`}
          data-selected={Boolean(selectedStore)}
          style={dragPosition === null ? undefined : ({
            transform: `translateY(${dragPosition}px)`,
            transition: "none",
          } as CSSProperties)}
        >
          <button
            type="button"
            className="sheet-drag-handle"
            aria-label="빵집 목록 높이 조절"
            aria-expanded={sheetSnap !== "collapsed"}
            onPointerDown={startSheetDrag}
            onPointerMove={moveSheet}
            onPointerUp={endSheetDrag}
            onPointerCancel={endSheetDrag}
          >
            <span aria-hidden="true" />
          </button>

          <div className="sidebar-tabs" role="tablist" aria-label="빵집 목록">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "nearby"}
              onClick={() => changeTab("nearby")}
            >
              <MapPin aria-hidden="true" size={15} /> 내 주변 빵집
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "favorites"}
              onClick={() => changeTab("favorites")}
            >
              <Heart aria-hidden="true" size={15} /> 나만의 빵지도
            </button>
          </div>

          {selectedStore ? (
            <div className="mobile-selected-store">
              <StoreCard
                dense
                store={selectedStore}
                isFavorite={favoriteIds.has(selectedStore.id)}
                favoritePending={favoriteMutation.isPending && favoriteMutation.variables?.storeId === selectedStore.id}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          ) : null}

          <div className="store-list">
            {activeTab === "favorites" && authStatus === "anonymous" ? (
              <div className="sidebar-login-state">
                <strong>로그인하고 나만의 빵지도를 만들어보세요.</strong>
                <button type="button" onClick={() => openLogin("/")}>로그인</button>
              </div>
            ) : null}
            {listLoading ? <LoadingState label="빵집 목록을 불러오는 중" /> : null}
            {listError ? (
              <ErrorState
                onRetry={() => void (
                  activeTab === "nearby" ? storesQuery.refetch() : favoriteStoresQuery.refetch()
                )}
              />
            ) : null}
            {!listLoading && !listError && !(activeTab === "favorites" && authStatus === "anonymous") && visibleStores.length === 0 ? (
              <EmptyState
                title={activeTab === "favorites" ? "저장한 빵집이 없어요" : "빵집을 찾지 못했어요"}
                description={activeTab === "favorites" ? "가게의 하트를 눌러 나만의 빵지도를 채워보세요." : undefined}
                icon={activeTab === "nearby" ? "x" : "map"}
              />
            ) : null}
            {visibleStores.map((store) => (
              <StoreCard
                dense
                key={store.id}
                store={store}
                location={location}
                congestion={congestionByStore.get(store.id)}
                summary={summaryByStore.get(store.id)}
                selected={selectedStoreId === store.id}
                onSelect={selectStore}
                isFavorite={favoriteIds.has(store.id)}
                favoritePending={favoriteMutation.isPending && favoriteMutation.variables?.storeId === store.id}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
          <footer className="sidebar-footer">
            <Link href="/privacy">개인정보처리방침</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms">서비스 이용약관</Link>
          </footer>
        </div>
      </section>

      {selectedStore ? (
        <StoreMapPanel
          key={selectedStore.id}
          placement={detailPlacement}
          store={selectedStore}
          congestion={congestionByStore.get(selectedStore.id)}
          summary={summaryByStore.get(selectedStore.id)}
          onClose={() => setSelectedStoreId(null)}
        />
      ) : null}

      <section className="map-panel" aria-label="빵집 지도">
        <BakeryMap
          center={selectedStore ?? mapCenter}
          focusRequest={mapFocus}
          userLocation={locationStatus === "precise" ? location : null}
          locationStatus={locationStatus}
          stores={mapStores}
          selectedStoreId={selectedStoreId}
          onSelect={selectStore}
          onLocate={() => void locateUser()}
          onSearchHere={searchCurrentArea}
          onViewportChange={updateViewport}
          onMapClick={() => setSelectedStoreId(null)}
        />
      </section>
    </main>
  );
}

"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MapPin, Search, X } from "lucide-react";
import type { Store, StoreBounds } from "@/entities/types";
import { useAuth } from "@/features/auth/auth-context";
import { consumeMapLoginModalRequest } from "@/features/auth/login-handoff";
import { useLoginModal } from "@/features/auth/login-modal";
import {
  optimisticallySetFavorite,
  rollbackFavoriteCache,
} from "@/features/favorites/favorite-cache";
import { BakeryMap, type MapViewport } from "@/features/map/bakery-map";
import { StoreCard } from "@/features/stores/store-card";
import { StoreMapPanel } from "@/features/stores/store-map-panel";
import { bbangbatApi } from "@/shared/api/bbangbat-api";
import { useGeolocation } from "@/shared/hooks/use-geolocation";
import { DEFAULT_LOCATION, distanceInKm, isWithinDaejeon } from "@/shared/lib/format";
import { limitTextInput } from "@/shared/lib/text-input";
import { useFeedback } from "@/shared/ui/feedback-provider";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/states";

type SheetSnap = "collapsed" | "expanded";
type SidebarTab = "nearby" | "favorites";
type DetailPlacement = "floating" | "sidebar";

const COLLAPSED_SHEET_HEIGHT = 270;

export function HomeScreen({
  initialStoreId = null,
  initialDetailPlacement = "floating",
}: {
  initialStoreId?: number | null;
  initialDetailPlacement?: DetailPlacement;
}) {
  const queryClient = useQueryClient();
  const { accessToken, memberId, status: authStatus } = useAuth();
  const { openLogin } = useLoginModal();
  const { location, status: locationStatus, requestLocation } = useGeolocation();
  const { notify } = useFeedback();
  const [activeTab, setActiveTab] = useState<SidebarTab>("nearby");
  const [query, setQuery] = useState("");
  const [viewportCenter, setViewportCenter] = useState(DEFAULT_LOCATION);
  const [viewportBounds, setViewportBounds] = useState<StoreBounds | null>(null);
  const [areaSearchLocation, setAreaSearchLocation] = useState(DEFAULT_LOCATION);
  const [areaSearchBounds, setAreaSearchBounds] = useState<StoreBounds | null>(null);
  const [mapFocus, setMapFocus] = useState({
    id: 0,
    center: DEFAULT_LOCATION,
    level: 5,
    offsetForPanel: false,
    preserveLevel: false,
  });
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("collapsed");
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(initialStoreId);
  const [searchedStore, setSearchedStore] = useState<Store | null>(null);
  const [detailOpen, setDetailOpen] = useState(Boolean(initialStoreId));
  const [detailPlacement, setDetailPlacement] = useState<DetailPlacement>(initialDetailPlacement);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; baseY: number } | null>(null);
  const initialStoreFocusRef = useRef(false);
  const initialAreaViewportRef = useRef<MapViewport | null>(null);
  const mobileSearchSelectionRef = useRef(false);
  const deferredQuery = useDeferredValue(query.trim());

  const storesQuery = useQuery({
    queryKey: areaSearchBounds
      ? [
          "stores",
          "bounds",
          areaSearchBounds.south.toFixed(5),
          areaSearchBounds.north.toFixed(5),
          areaSearchBounds.west.toFixed(5),
          areaSearchBounds.east.toFixed(5),
        ]
      : ["stores", "bounds", "pending"],
    queryFn: () => bbangbatApi.getStoresByBounds(areaSearchBounds!, areaSearchLocation),
    enabled: areaSearchBounds !== null,
    placeholderData: (previousData) => previousData,
  });
  const favoriteIdsQuery = useQuery({
    queryKey: ["favorites", memberId],
    queryFn: () => bbangbatApi.getFavorites(accessToken!),
    enabled: Boolean(accessToken && memberId),
  });
  const favoriteStoresQuery = useQuery({
    queryKey: ["favorite-stores", memberId, favoriteIdsQuery.data],
    queryFn: () => bbangbatApi.getStoresBulk(favoriteIdsQuery.data ?? []),
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
  const congestionStoreIds = useMemo(() => {
    const storeIds = new Set(allKnownStores.map((store) => store.id));
    if (selectedStoreId) storeIds.add(selectedStoreId);
    return [...storeIds];
  }, [allKnownStores, selectedStoreId]);

  const congestionsQuery = useQuery({
    queryKey: ["congestions", congestionStoreIds],
    queryFn: () => bbangbatApi.getCongestions(congestionStoreIds),
    enabled: congestionStoreIds.length > 0,
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
    enabled: deferredQuery.length >= 1,
    staleTime: 5 * 60_000,
  });

  const knownSelectedStore =
    allKnownStores.find((store) => store.id === selectedStoreId)
    ?? (searchedStore?.id === selectedStoreId ? searchedStore : null);
  const selectedStoreQuery = useQuery({
    queryKey: ["store", selectedStoreId],
    queryFn: () => bbangbatApi.getStore(selectedStoreId!),
    enabled: Boolean(selectedStoreId) && !knownSelectedStore,
  });
  const selectedStore = knownSelectedStore ?? selectedStoreQuery.data ?? null;

  useEffect(() => {
    const returnTo = consumeMapLoginModalRequest();
    if (!returnTo) return;
    queueMicrotask(() => openLogin(returnTo));
  }, [openLogin]);

  useEffect(() => {
    if (
      initialStoreFocusRef.current
      || !initialStoreId
      || selectedStore?.id !== initialStoreId
    ) return;

    initialStoreFocusRef.current = true;
    setViewportCenter(selectedStore);
    setMapFocus((current) => ({
      id: current.id + 1,
      center: selectedStore,
      level: 3,
      offsetForPanel: initialDetailPlacement === "floating",
      preserveLevel: false,
    }));
  }, [initialDetailPlacement, initialStoreId, selectedStore]);

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
    if (searchedStore) stores.set(searchedStore.id, searchedStore);
    if (selectedStore) stores.set(selectedStore.id, selectedStore);
    return [...stores.values()];
  }, [nearbyStores, searchedStore, selectedStore]);

  const favoriteMutation = useMutation({
    mutationFn: ({ store, nextFavorite }: { store: Store; nextFavorite: boolean }) =>
      nextFavorite
        ? bbangbatApi.addFavorite(store.id, accessToken!)
        : bbangbatApi.removeFavorite(store.id, accessToken!),
    onMutate: ({ store, nextFavorite }) =>
      optimisticallySetFavorite(
        queryClient,
        memberId!,
        store,
        nextFavorite,
        allKnownStores,
      ),
    onSuccess: (_data, { nextFavorite }) => {
      notify(nextFavorite ? "나만의 빵지도에 저장했어요." : "나만의 빵지도에서 삭제했어요.", "success");
    },
    onError: (error, _variables, snapshot) => {
      rollbackFavoriteCache(queryClient, memberId!, snapshot);
      notify(error instanceof Error ? error.message : "즐겨찾기를 변경하지 못했어요.", "error");
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
        queryClient.invalidateQueries({ queryKey: ["favorite-stores"] }),
      ]);
    },
  });

  function updateSelectedStoreId(storeId: number | null, placement?: DetailPlacement) {
    setSelectedStoreId(storeId);
    setDetailOpen(Boolean(storeId));
    if (placement) setDetailPlacement(placement);
    const url = new URL(window.location.href);
    if (storeId) {
      url.searchParams.set("storeId", String(storeId));
      if (placement === "sidebar") url.searchParams.set("detail", "sidebar");
      else url.searchParams.delete("detail");
    } else {
      url.searchParams.delete("storeId");
      url.searchParams.delete("detail");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function sheetBasePosition(snap: SheetSnap, height: number): number {
    if (snap === "expanded") return 0;
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

    if (delta > 55) {
      setSheetSnap("collapsed");
    } else if (delta < -55) {
      setSheetSnap("expanded");
    } else if (Math.abs(delta) < 8) {
      setSheetSnap(sheetSnap === "collapsed" ? "expanded" : "collapsed");
    }

    dragRef.current = null;
    setDragPosition(null);
  }

  async function locateUser() {
    updateSelectedStoreId(null);
    setSearchedStore(null);
    mobileSearchSelectionRef.current = false;
    setSheetSnap("collapsed");
    try {
      const coordinates = await requestLocation();
      if (isWithinDaejeon(coordinates)) {
        focusMap(coordinates, 4);
        notify("현재 위치로 이동했어요.", "success");
      } else {
        focusMap(DEFAULT_LOCATION, 4);
        notify("현재 위치가 대전 밖이라 대전 기본 위치로 이동했어요.", "info");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "현재 위치를 확인하지 못했어요.", "error");
    }
  }

  function focusMap(
    center: typeof DEFAULT_LOCATION,
    level: number,
    offsetForPanel = false,
    preserveLevel = false,
  ) {
    setViewportCenter(center);
    setMapFocus((current) => ({
      id: current.id + 1,
      center,
      level,
      offsetForPanel,
      preserveLevel,
    }));
  }

  function selectStore(storeId: number) {
    setSearchedStore(null);
    mobileSearchSelectionRef.current = false;
    updateSelectedStoreId(storeId, "floating");
    setSheetSnap("collapsed");
    const store = allKnownStores.find((item) => item.id === storeId);
    if (store) focusMap(store, 3, true);
  }

  function selectMapStore(storeId: number) {
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (isMobile) {
      setSelectedStoreId(storeId);
      setDetailOpen(false);
      setDetailPlacement("floating");
      const url = new URL(window.location.href);
      url.searchParams.delete("storeId");
      url.searchParams.delete("detail");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } else {
      updateSelectedStoreId(storeId, "floating");
    }
    setSheetSnap("collapsed");
    const store = mapStores.find((item) => item.id === storeId);
    if (store) {
      focusMap(store, 3, true, true);
    }
  }

  async function selectSearchResult(storeId: number) {
    try {
      const store = await queryClient.fetchQuery({
        queryKey: ["store", storeId],
        queryFn: () => bbangbatApi.getStore(storeId),
      });
      const isMobile = window.matchMedia("(max-width: 900px)").matches;
      if (isMobile) {
        setActiveTab("nearby");
        setSearchedStore(store);
        mobileSearchSelectionRef.current = true;
        setSelectedStoreId(storeId);
        setDetailOpen(false);
        setDetailPlacement("floating");
        const url = new URL(window.location.href);
        url.searchParams.delete("storeId");
        url.searchParams.delete("detail");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      } else {
        updateSelectedStoreId(storeId, "sidebar");
      }
      setSheetSnap("collapsed");
      setQuery("");
      focusMap(store, 3, isMobile);
    } catch (error) {
      notify(error instanceof Error ? error.message : "빵집 정보를 불러오지 못했어요.", "error");
    }
  }

  function openSelectedStoreDetail(storeId: number) {
    updateSelectedStoreId(storeId, "floating");
    setSheetSnap("expanded");
  }

  function closeSelectedStoreDetail() {
    updateSelectedStoreId(null);
    setSheetSnap("collapsed");
    if (!mobileSearchSelectionRef.current) return;

    mobileSearchSelectionRef.current = false;
    setActiveTab("nearby");
    setQuery("");
    const initialArea = initialAreaViewportRef.current;
    if (initialArea) {
      setAreaSearchLocation(initialArea.center);
      setAreaSearchBounds(initialArea.bounds);
    }
  }

  function searchCurrentArea(searchViewport?: MapViewport) {
    setActiveTab("nearby");
    setSearchedStore(null);
    mobileSearchSelectionRef.current = false;
    updateSelectedStoreId(null);
    setQuery("");
    const nextSearchCenter = searchViewport?.center ?? viewportCenter;
    const nextSearchBounds = searchViewport?.bounds ?? viewportBounds;
    const nextBoundsKey = nextSearchBounds ? JSON.stringify(nextSearchBounds) : "";
    const currentBoundsKey = areaSearchBounds ? JSON.stringify(areaSearchBounds) : "";
    const areaChanged = distanceInKm(areaSearchLocation, nextSearchCenter) >= 0.01
      || nextBoundsKey !== currentBoundsKey;
    setAreaSearchLocation(nextSearchCenter);
    setAreaSearchBounds(nextSearchBounds);
    if (!areaChanged) void storesQuery.refetch();
  }

  function updateViewport(nextViewport: MapViewport) {
    setViewportCenter(nextViewport.center);
    setViewportBounds(nextViewport.bounds);
    if (initialAreaViewportRef.current) return;

    initialAreaViewportRef.current = nextViewport;
    setAreaSearchLocation(nextViewport.center);
    setAreaSearchBounds(nextViewport.bounds);
  }

  function changeTab(tab: SidebarTab) {
    setActiveTab(tab);
    setSearchedStore(null);
    mobileSearchSelectionRef.current = false;
    setQuery("");
    updateSelectedStoreId(null);
    setSheetSnap("collapsed");
  }

  function toggleFavorite(storeId: number) {
    if (!accessToken) {
      openLogin("/");
      return;
    }
    const store = allKnownStores.find((item) => item.id === storeId)
      ?? (selectedStore?.id === storeId ? selectedStore : null);
    if (!store) return;
    favoriteMutation.mutate({ store, nextFavorite: !favoriteIds.has(storeId) });
  }

  const listLoading =
    activeTab === "nearby"
      ? areaSearchBounds === null || storesQuery.isLoading
      : authStatus === "initializing" || favoriteIdsQuery.isLoading || favoriteStoresQuery.isLoading;
  const listError = activeTab === "nearby" ? storesQuery.isError : favoriteStoresQuery.isError;

  return (
    <main
      className="home-shell"
      data-detail-open={Boolean(selectedStore) && detailOpen}
      data-detail-placement={detailPlacement}
      data-searching={query.trim().length > 0}
    >
      <section className="explore-panel" data-searching={query.trim().length > 0} aria-label="빵집 탐색">
        <div className="search-box">
          <Search aria-hidden="true" size={19} />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            maxLength={50}
            onChange={(event) => setQuery(limitTextInput(event.target.value, 50))}
            placeholder="빵집 이름을 검색해 보세요"
            aria-label="빵집 검색"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">
              <X aria-hidden="true" size={17} />
            </button>
          ) : null}
          {deferredQuery.length >= 1 ? (
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
          data-selected={Boolean(selectedStore) && !detailOpen}
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

          {selectedStore && !detailOpen ? (
            <div className="mobile-selected-store">
              <StoreCard
                dense
                store={selectedStore}
                onSelect={openSelectedStoreDetail}
                isFavorite={favoriteIds.has(selectedStore.id)}
                favoritePending={favoriteMutation.isPending && favoriteMutation.variables?.store.id === selectedStore.id}
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
                  activeTab === "nearby"
                    ? storesQuery.refetch()
                    : favoriteStoresQuery.refetch()
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
                favoritePending={favoriteMutation.isPending && favoriteMutation.variables?.store.id === store.id}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
          <footer className="sidebar-footer">
            <span className="sidebar-footer-copyright">© 2026 빵밭. All rights reserved.</span>
            <span className="sidebar-footer-links">
              <Link href="/privacy">개인정보처리방침</Link>
              <span className="sidebar-footer-separator" aria-hidden="true">|</span>
              <Link href="/terms">서비스 이용약관</Link>
            </span>
          </footer>
        </div>
      </section>

      {selectedStore && detailOpen ? (
        <StoreMapPanel
          key={selectedStore.id}
          placement={detailPlacement}
          store={selectedStore}
          congestion={congestionByStore.get(selectedStore.id)}
          summary={summaryByStore.get(selectedStore.id)}
          onClose={closeSelectedStoreDetail}
        />
      ) : null}

      <section className="map-panel" aria-label="빵집 지도">
        <BakeryMap
          center={DEFAULT_LOCATION}
          focusRequest={mapFocus}
          userLocation={locationStatus === "precise" ? location : null}
          locationStatus={locationStatus}
          stores={mapStores}
          congestionByStore={congestionByStore}
          selectedStoreId={selectedStoreId}
          onSelect={selectMapStore}
          onLocate={() => void locateUser()}
          onSearchHere={searchCurrentArea}
          mobileSearchBottomInset={COLLAPSED_SHEET_HEIGHT}
          onViewportChange={updateViewport}
          onMapClick={() => updateSelectedStoreId(null)}
        />
      </section>
    </main>
  );
}

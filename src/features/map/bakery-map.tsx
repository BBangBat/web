"use client";

import { useEffect, useRef, useState } from "react";
import { CustomOverlayMap, Map, useKakaoLoader } from "react-kakao-maps-sdk";
import { Crosshair, Minus, Plus, Search, Wheat } from "lucide-react";
import type { Congestion, Coordinates, Store } from "@/entities/types";
import { env } from "@/shared/config/env";
import { congestionCopy, DAEJEON_BOUNDS, DEFAULT_LOCATION } from "@/shared/lib/format";
import type { LocationStatus } from "@/shared/hooks/use-geolocation";

type MapFocusRequest = {
  id: number;
  center: Coordinates;
  level: number;
  offsetForPanel: boolean;
  preserveLevel?: boolean;
};

export type MapViewport = {
  center: Coordinates;
  bounds: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
  level: number;
};

type BakeryMapProps = {
  center: Coordinates;
  focusRequest: MapFocusRequest;
  userLocation: Coordinates | null;
  locationStatus: LocationStatus;
  stores: Store[];
  congestionByStore: ReadonlyMap<number, Congestion>;
  selectedStoreId: number | null;
  onSelect: (storeId: number) => void;
  onLocate: () => void;
  onSearchHere: () => void;
  onMapClick: () => void;
  onViewportChange: (viewport: MapViewport) => void;
};

function MapUnavailable({ onLocate }: Pick<BakeryMapProps, "onLocate">) {
  return (
    <div className="map-fallback">
      <div className="map-field-lines" aria-hidden="true" />
      <div className="map-fallback-copy">
        <strong>지도를 준비하고 있어요</strong>
        <p>카카오 지도 키를 설정하면 내 주변 빵집을 지도에서 볼 수 있어요.</p>
      </div>
      <button type="button" className="map-locate-button" onClick={onLocate} aria-label="현재 위치" title="현재 위치">
        <Crosshair aria-hidden="true" size={18} />
      </button>
    </div>
  );
}

function KakaoMapCanvas(props: BakeryMapProps) {
  const [loading, error] = useKakaoLoader({
    appkey: env.kakaoMapAppKey,
    libraries: ["services"],
  });
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const [mapLevel, setMapLevel] = useState(5);
  const [maximumLevel, setMaximumLevel] = useState(7);

  function configureZoomBounds(map: kakao.maps.Map) {
    const bounds = map.getBounds();
    const latitudeSpan = bounds.getNorthEast().getLat() - bounds.getSouthWest().getLat();
    const longitudeSpan = bounds.getNorthEast().getLng() - bounds.getSouthWest().getLng();
    const daejeonLatitudeSpan = DAEJEON_BOUNDS.north - DAEJEON_BOUNDS.south;
    const daejeonLongitudeSpan = DAEJEON_BOUNDS.east - DAEJEON_BOUNDS.west;
    const fitRatio = Math.min(
      daejeonLatitudeSpan / latitudeSpan,
      daejeonLongitudeSpan / longitudeSpan,
    );
    const additionalLevels = Math.floor(Math.log2(Math.max(fitRatio, 0.01)));
    const nextMaximumLevel = Math.min(8, Math.max(1, map.getLevel() + additionalLevels));

    map.setMinLevel(1);
    map.setMaxLevel(nextMaximumLevel);
    if (map.getLevel() > nextMaximumLevel) map.setLevel(nextMaximumLevel);
    setMaximumLevel((current) => current === nextMaximumLevel ? current : nextMaximumLevel);
  }

  function constrainToDaejeon(map: kakao.maps.Map) {
    const bounds = map.getBounds();
    const center = map.getCenter();
    const latitudeHalfSpan = (bounds.getNorthEast().getLat() - bounds.getSouthWest().getLat()) / 2;
    const longitudeHalfSpan = (bounds.getNorthEast().getLng() - bounds.getSouthWest().getLng()) / 2;
    const minimumLatitude = DAEJEON_BOUNDS.south + latitudeHalfSpan;
    const maximumLatitude = DAEJEON_BOUNDS.north - latitudeHalfSpan;
    const minimumLongitude = DAEJEON_BOUNDS.west + longitudeHalfSpan;
    const maximumLongitude = DAEJEON_BOUNDS.east - longitudeHalfSpan;
    const latitude =
      minimumLatitude > maximumLatitude
        ? DEFAULT_LOCATION.latitude
        : Math.min(maximumLatitude, Math.max(minimumLatitude, center.getLat()));
    const longitude =
      minimumLongitude > maximumLongitude
        ? DEFAULT_LOCATION.longitude
        : Math.min(maximumLongitude, Math.max(minimumLongitude, center.getLng()));

    if (latitude !== center.getLat() || longitude !== center.getLng()) {
      map.setCenter(new kakao.maps.LatLng(latitude, longitude));
    }
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading || error) return;
    const requestedLevel = props.focusRequest.preserveLevel
      ? map.getLevel()
      : Math.min(maximumLevel, Math.max(1, props.focusRequest.level));
    if (!props.focusRequest.preserveLevel) map.setLevel(requestedLevel);
    map.setCenter(new kakao.maps.LatLng(
      props.focusRequest.center.latitude,
      props.focusRequest.center.longitude,
    ));
    setMapLevel(requestedLevel);

    if (props.focusRequest.offsetForPanel && window.matchMedia("(min-width: 901px)").matches) {
      const frame = window.requestAnimationFrame(() => map.panBy(-190, 0));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [error, loading, maximumLevel, props.focusRequest]);

  if (loading) return <div className="map-loading">지도를 불러오는 중…</div>;
  if (error) return <MapUnavailable onLocate={props.onLocate} />;

  function zoomIn() {
    const map = mapRef.current;
    if (!map || map.getLevel() <= 1) return;
    map.setLevel(map.getLevel() - 1);
  }

  function zoomOut() {
    const map = mapRef.current;
    if (!map || map.getLevel() >= maximumLevel) return;
    map.setLevel(map.getLevel() + 1);
  }

  const showStoreNames = mapLevel <= 4;

  return (
    <div className="map-wrap" data-map-level={mapLevel} data-max-map-level={maximumLevel}>
      <Map
        center={{ lat: props.center.latitude, lng: props.center.longitude }}
        isPanto
        level={5}
        zoomable
        scrollwheel
        keyboardShortcuts
        className="kakao-map"
        onCreate={(map) => {
          mapRef.current = map;
          configureZoomBounds(map);
          constrainToDaejeon(map);
          setMapLevel(map.getLevel());
        }}
        onCenterChanged={constrainToDaejeon}
        onZoomChanged={(map) => {
          setMapLevel(map.getLevel());
          constrainToDaejeon(map);
        }}
        onBoundsChanged={(map) => {
          configureZoomBounds(map);
          constrainToDaejeon(map);
        }}
        onIdle={(map) => {
          constrainToDaejeon(map);
          const center = map.getCenter();
          const bounds = map.getBounds();
          const southWest = bounds.getSouthWest();
          const northEast = bounds.getNorthEast();
          props.onViewportChange({
            center: {
              latitude: center.getLat(),
              longitude: center.getLng(),
            },
            bounds: {
              south: southWest.getLat(),
              north: northEast.getLat(),
              west: southWest.getLng(),
              east: northEast.getLng(),
            },
            level: map.getLevel(),
          });
        }}
        onClick={props.onMapClick}
      >
        {props.userLocation ? (
          <CustomOverlayMap
            position={{ lat: props.userLocation.latitude, lng: props.userLocation.longitude }}
            xAnchor={0.5}
            yAnchor={0.5}
            zIndex={40}
          >
            <span className="user-location-marker" aria-label="내 현재 위치">
              <i aria-hidden="true" />
            </span>
          </CustomOverlayMap>
        ) : null}
        {props.stores.map((store) => {
          const selected = props.selectedStoreId === store.id;
          const congestion = props.congestionByStore.get(store.id);
          const congestionLabel = congestion ? congestionCopy[congestion.current].shortLabel : null;
          return (
            <CustomOverlayMap
              key={store.id}
              position={{ lat: store.latitude, lng: store.longitude }}
              xAnchor={0.5}
              yAnchor={showStoreNames ? 0.28 : 0.5}
              zIndex={selected ? 20 : 10}
            >
              <button
                type="button"
                className="bakery-label-marker"
                data-selected={selected}
                data-name-visible={showStoreNames}
                aria-label={congestionLabel ? `${store.name}, 혼잡도 ${congestionLabel}` : store.name}
                onClick={() => props.onSelect(store.id)}
              >
                {congestion ? (
                  <span
                    className="bakery-label-status"
                    data-compact={!showStoreNames}
                    data-level={congestion.current.toLowerCase()}
                    aria-hidden="true"
                  >
                    {showStoreNames ? congestionLabel : null}
                  </span>
                ) : null}
                <span className="bakery-label-icon" aria-hidden="true"><Wheat size={13} /></span>
                {showStoreNames ? <span className="bakery-label-name">{store.name}</span> : null}
              </button>
            </CustomOverlayMap>
          );
        })}
      </Map>

      <div className="map-control-stack" aria-label="지도 확대 축소">
        <button type="button" onClick={zoomIn} disabled={mapLevel <= 1} aria-label="지도 확대" title="지도 확대">
          <Plus aria-hidden="true" size={19} />
        </button>
        <button type="button" onClick={zoomOut} disabled={mapLevel >= maximumLevel} aria-label="지도 축소" title="지도 축소">
          <Minus aria-hidden="true" size={19} />
        </button>
      </div>
      <button
        type="button"
        className="map-locate-button"
        data-loading={props.locationStatus === "locating"}
        onClick={props.onLocate}
        disabled={props.locationStatus === "locating"}
        aria-label="현재 위치"
        title="현재 위치"
      >
        <Crosshair aria-hidden="true" size={18} />
      </button>
      <button type="button" className="map-search-here" onClick={props.onSearchHere}>
        <Search aria-hidden="true" size={16} /> 현재 위치에서 검색
      </button>
    </div>
  );
}

export function BakeryMap(props: BakeryMapProps) {
  if (!env.kakaoMapAppKey) return <MapUnavailable onLocate={props.onLocate} />;
  return <KakaoMapCanvas {...props} />;
}

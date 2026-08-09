"use client";

import { useCallback, useEffect, useState } from "react";
import type { Coordinates } from "@/entities/types";
import { env } from "@/shared/config/env";
import { DEFAULT_LOCATION } from "@/shared/lib/format";

export type LocationStatus = "locating" | "precise" | "fallback";

function geolocationError(error: GeolocationPositionError): Error {
  if (error.code === error.PERMISSION_DENIED) {
    return new Error("브라우저의 위치 권한을 허용해 주세요.");
  }
  if (error.code === error.TIMEOUT) {
    return new Error("위치 확인 시간이 초과됐어요. 다시 시도해 주세요.");
  }
  return new Error("현재 위치를 확인할 수 없어요.");
}

export function getCurrentCoordinates(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("이 브라우저에서는 위치 기능을 지원하지 않아요."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(geolocationError(error)),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  });
}

type CongestionVoteCoordinatesOptions = {
  developmentCoordinates?: Coordinates;
  useDevelopmentLocation?: boolean;
  coordinatesProvider?: () => Promise<Coordinates>;
};

export async function getCongestionVoteCoordinates({
  developmentCoordinates = DEFAULT_LOCATION,
  useDevelopmentLocation = env.usesDevelopmentCongestionVoteLocation,
  coordinatesProvider = getCurrentCoordinates,
}: CongestionVoteCoordinatesOptions = {}): Promise<Coordinates> {
  if (useDevelopmentLocation) return developmentCoordinates;
  return coordinatesProvider();
}

export function useGeolocation() {
  const [location, setLocation] = useState<Coordinates>(DEFAULT_LOCATION);
  const [status, setStatus] = useState<LocationStatus>("locating");

  const requestLocation = useCallback(async () => {
    setStatus("locating");

    let coordinates: Coordinates;
    try {
      coordinates = await getCurrentCoordinates();
    } catch (error) {
      setStatus("fallback");
      throw error;
    }

    setLocation(coordinates);
    setStatus("precise");
    return coordinates;
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setStatus("fallback"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = { latitude: coords.latitude, longitude: coords.longitude };
        setLocation(coordinates);
        setStatus("precise");
      },
      () => setStatus("fallback"),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  }, []);

  return { location, status, requestLocation };
}

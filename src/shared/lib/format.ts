import type { CongestionLevel, Coordinates } from "@/entities/types";

const EARTH_RADIUS_KM = 6371;

export const DEFAULT_LOCATION: Coordinates = {
  latitude: 36.3504,
  longitude: 127.3845,
};

export const DAEJEON_BOUNDS = {
  south: 36.1833683,
  north: 36.5002122,
  west: 127.2463188,
  east: 127.5408653,
} as const;

export function isWithinDaejeon(coordinates: Coordinates): boolean {
  return (
    coordinates.latitude >= DAEJEON_BOUNDS.south &&
    coordinates.latitude <= DAEJEON_BOUNDS.north &&
    coordinates.longitude >= DAEJEON_BOUNDS.west &&
    coordinates.longitude <= DAEJEON_BOUNDS.east
  );
}

export function hasStoreImage(imageUrl: string | null | undefined): imageUrl is string {
  return Boolean(imageUrl);
}

export function distanceInKm(from: Coordinates, to: Coordinates): number {
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(distance: number): string {
  return distance < 1
    ? `${Math.max(10, Math.round((distance * 1000) / 10) * 10)}m`
    : `${distance.toFixed(1)}km`;
}

export function compactAddress(address: string): string {
  return address.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

export function relativeTime(value: string | null): string {
  if (!value) return "방금 전";

  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function compactReviewDate(value: string | null, now = new Date()): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (date.getFullYear() === now.getFullYear()) return `${month}.${day}`;
  const year = String(date.getFullYear()).slice(-2).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export const congestionCopy: Record<
  CongestionLevel,
  { label: string; shortLabel: string; description: string }
> = {
  UNCROWDED: {
    label: "여유",
    shortLabel: "여유",
    description: "바로 둘러보기 좋아요",
  },
  NORMAL: {
    label: "보통",
    shortLabel: "보통",
    description: "조금 기다릴 수 있어요",
  },
  CROWDED: {
    label: "혼잡",
    shortLabel: "혼잡",
    description: "대기 시간을 확인해요",
  },
};

export function averageRating(reviews: { rating: number }[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}

export function isSafeInternalPath(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}

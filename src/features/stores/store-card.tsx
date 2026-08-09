import Link from "next/link";
import { ArrowUpRight, Heart, MessageCircleMore, Navigation, Star } from "lucide-react";
import type { Congestion, Coordinates, Store, TalkSummary } from "@/entities/types";
import {
  compactAddress,
  congestionCopy,
  distanceInKm,
  formatDistance,
  hasStoreImage,
} from "@/shared/lib/format";

type StoreCardProps = {
  store: Store;
  location?: Coordinates;
  congestion?: Congestion;
  summary?: TalkSummary;
  compact?: boolean;
  dense?: boolean;
  showCongestion?: boolean;
  selected?: boolean;
  onSelect?: (storeId: number) => void;
  isFavorite?: boolean;
  favoritePending?: boolean;
  onToggleFavorite?: (storeId: number) => void;
};

export function StoreCard({
  store,
  location,
  congestion,
  summary,
  compact = false,
  dense = false,
  showCongestion = false,
  selected = false,
  onSelect,
  isFavorite = false,
  favoritePending = false,
  onToggleFavorite,
}: StoreCardProps) {
  const distance = location ? distanceInKm(location, store) : null;
  const congestionLevel = congestion?.current ?? "UNCROWDED";
  const hasCustomImage = hasStoreImage(store.imageUrl);
  const className = [
    "store-card",
    compact ? "store-card-compact" : "",
    dense ? "store-card-dense" : "",
  ].filter(Boolean).join(" ");

  if (dense) {
    const selectContent = (
      <>
        <div
          className="store-card-image"
          style={hasCustomImage ? { backgroundImage: `url(${store.imageUrl})` } : undefined}
          aria-hidden="true"
        >
          {!hasCustomImage ? <span>BB</span> : null}
        </div>
        <div className="store-card-body">
          <h3>{store.name}</h3>
          <p>{compactAddress(store.address)}</p>
        </div>
      </>
    );

    return (
      <div className={className} data-selected={selected}>
        {onSelect ? (
          <button type="button" className="store-card-select" onClick={() => onSelect(store.id)}>
            {selectContent}
          </button>
        ) : (
          <Link href={`/stores/${store.id}`} className="store-card-select">
            {selectContent}
          </Link>
        )}
        {onToggleFavorite || showCongestion ? (
          <div className="store-card-dense-actions">
            {showCongestion ? (
              congestion ? (
                <span className={`store-card-dense-congestion congestion-${congestion.current.toLowerCase()}`}>
                  <i aria-hidden="true" />
                  {congestionCopy[congestion.current].shortLabel}
                </span>
              ) : <span className="store-card-dense-congestion-loading">확인 중</span>
            ) : null}
            {onToggleFavorite ? (
              <button
                type="button"
                className="store-card-favorite"
                aria-label={isFavorite ? `${store.name} 즐겨찾기 해제` : `${store.name} 즐겨찾기`}
                aria-pressed={isFavorite}
                disabled={favoritePending}
                onClick={() => onToggleFavorite(store.id)}
              >
                <Heart aria-hidden="true" size={18} fill={isFavorite ? "currentColor" : "none"} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  const content = (
    <>
      <div
        className="store-card-image"
        style={hasCustomImage ? { backgroundImage: `url(${store.imageUrl})` } : undefined}
        aria-hidden="true"
      >
        {!hasCustomImage ? <span>BB</span> : null}
        <span className={`congestion-badge congestion-${congestionLevel.toLowerCase()}`}>
          <i aria-hidden="true" />
          {congestionCopy[congestionLevel].shortLabel}
        </span>
      </div>
      <div className="store-card-body">
        <div className="store-card-heading">
          <div>
            <h3>{store.name}</h3>
            <p>{compactAddress(store.address)}</p>
          </div>
          <ArrowUpRight aria-hidden="true" size={19} />
        </div>
        <div className="store-card-meta">
          {distance !== null ? (
            <span>
              <Navigation aria-hidden="true" size={13} /> {formatDistance(distance)}
            </span>
          ) : null}
          <span>
            <Star aria-hidden="true" size={13} /> 빵명록
          </span>
        </div>
        {summary ? (
          <div className="talk-summary">
            <MessageCircleMore aria-hidden="true" size={15} />
            <span>{summary.summary}</span>
          </div>
        ) : null}
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={className}
        data-selected={selected}
        aria-pressed={selected}
        onClick={() => onSelect(store.id)}
      >
        {content}
      </button>
    );
  }

  return <Link href={`/stores/${store.id}`} className={className}>{content}</Link>;
}

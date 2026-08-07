import { CircleAlert, CircleX, LoaderCircle, MapPinned } from "lucide-react";

export function LoadingState({ label = "불러오는 중" }: { label?: string }) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="animate-spin text-orange" aria-hidden="true" size={28} />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  message = "정보를 불러오지 못했어요.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-panel" role="alert">
      <CircleAlert aria-hidden="true" size={28} />
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="button button-secondary button-small" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = "map",
}: {
  title: string;
  description?: string;
  icon?: "map" | "x";
}) {
  return (
    <div className="state-panel">
      {icon === "x" ? <CircleX aria-hidden="true" size={29} /> : <MapPinned aria-hidden="true" size={29} />}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

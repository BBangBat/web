type SearchAreaInput = {
  width: number;
  height: number;
  mobileBottomInset: number;
  isMobile: boolean;
  restrictToControls: boolean;
  controlsRight?: number;
  searchButtonBottom?: number;
};

export type SearchAreaPixels = {
  right: number;
  bottom: number;
};

function clampBoundary(value: number, maximum: number): number {
  return Math.min(maximum, Math.max(1, value));
}

export function resolveSearchAreaPixels({
  width,
  height,
  mobileBottomInset,
  isMobile,
  restrictToControls,
  controlsRight,
  searchButtonBottom,
}: SearchAreaInput): SearchAreaPixels {
  const visibleBottom = isMobile && mobileBottomInset > 0
    ? Math.max(1, height - Math.min(mobileBottomInset, height - 1))
    : height;

  if (!restrictToControls || !isMobile) return { right: width, bottom: visibleBottom };

  return {
    right: clampBoundary(controlsRight ?? width, width),
    bottom: Math.min(
      visibleBottom,
      clampBoundary(searchButtonBottom ?? visibleBottom, height),
    ),
  };
}

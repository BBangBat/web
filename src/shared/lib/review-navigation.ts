export function reviewMapHref(storeId: number, reviewId: number) {
  const searchParams = new URLSearchParams({
    storeId: String(storeId),
    detail: "sidebar",
    reviewId: String(reviewId),
  });

  return `/?${searchParams.toString()}`;
}

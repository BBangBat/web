export function moveReviewImage<T>(
  images: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0
    || fromIndex >= images.length
    || toIndex < 0
    || toIndex >= images.length
    || fromIndex === toIndex
  ) return [...images];

  const nextImages = [...images];
  const [image] = nextImages.splice(fromIndex, 1);
  if (image === undefined) return [...images];
  nextImages.splice(toIndex, 0, image);
  return nextImages;
}

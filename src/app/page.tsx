import { HomeScreen } from "@/features/home/home-screen";

export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const rawStoreId = Array.isArray(searchParams.storeId)
    ? searchParams.storeId[0]
    : searchParams.storeId;
  const parsedStoreId = Number(rawStoreId);
  const initialStoreId = Number.isInteger(parsedStoreId) && parsedStoreId > 0
    ? parsedStoreId
    : null;
  const rawDetailPlacement = Array.isArray(searchParams.detail)
    ? searchParams.detail[0]
    : searchParams.detail;
  const initialDetailPlacement = rawDetailPlacement === "sidebar" ? "sidebar" : "floating";
  const rawReviewId = Array.isArray(searchParams.reviewId)
    ? searchParams.reviewId[0]
    : searchParams.reviewId;
  const parsedReviewId = Number(rawReviewId);
  const initialReviewId = Number.isInteger(parsedReviewId) && parsedReviewId > 0
    ? parsedReviewId
    : null;

  return (
    <HomeScreen
      initialStoreId={initialStoreId}
      initialDetailPlacement={initialDetailPlacement}
      initialReviewId={initialReviewId}
    />
  );
}

import { notFound } from "next/navigation";
import { ReviewForm } from "@/features/reviews/review-form";

export default async function NewReviewPage(props: PageProps<"/reviews/new">) {
  const searchParams = await props.searchParams;
  const rawStoreId = Array.isArray(searchParams.storeId)
    ? searchParams.storeId[0]
    : searchParams.storeId;
  const storeId = Number(rawStoreId);
  if (!Number.isInteger(storeId) || storeId <= 0) notFound();

  return <ReviewForm storeId={storeId} />;
}

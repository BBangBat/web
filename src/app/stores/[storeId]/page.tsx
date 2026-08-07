import { notFound } from "next/navigation";
import { StoreDetailScreen } from "@/features/stores/store-detail-screen";

export default async function StoreDetailPage(props: PageProps<"/stores/[storeId]">) {
  const { storeId: rawStoreId } = await props.params;
  const storeId = Number(rawStoreId);
  if (!Number.isInteger(storeId) || storeId <= 0) notFound();

  return <StoreDetailScreen storeId={storeId} />;
}

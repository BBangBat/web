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

  return <HomeScreen initialStoreId={initialStoreId} />;
}

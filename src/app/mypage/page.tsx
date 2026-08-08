import { MypageScreen } from "@/features/members/mypage-screen";

export default async function Mypage(props: PageProps<"/mypage">) {
  const searchParams = await props.searchParams;
  const tab = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
  const initialTab = tab === "reviews" || tab === "favorites" || tab === "profile"
    ? tab
    : "overview";
  return <MypageScreen initialTab={initialTab} />;
}

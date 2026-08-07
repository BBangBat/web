import Link from "next/link";
import { Wheat } from "lucide-react";

export default function NotFound() {
  return (
    <main className="center-page">
      <div className="not-found-card">
        <Wheat aria-hidden="true" size={35} />
        <p className="eyebrow">404 NOT FOUND</p>
        <h1>이 밭에는 아직 빵이 없어요.</h1>
        <p>주소가 바뀌었거나 사라진 페이지예요.</p>
        <Link href="/" className="button button-primary">빵지도 돌아가기</Link>
      </div>
    </main>
  );
}

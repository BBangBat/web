import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TermsContent } from "@/features/legal/legal-content";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="mypage-map-link legal-map-link">
        <ArrowLeft aria-hidden="true" size={21} />
        <span>지도로 돌아가기</span>
      </Link>
      <TermsContent />
    </main>
  );
}

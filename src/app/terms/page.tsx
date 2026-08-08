import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="mypage-map-link legal-map-link">
        <ArrowLeft aria-hidden="true" size={21} />
        <span>지도로 돌아가기</span>
      </Link>
      <header className="legal-header">
        <h1>서비스 이용약관</h1>
        <p className="legal-meta">
          <span>버전 1.0</span>
          <span>시행일: 2026년 8월 7일</span>
        </p>
      </header>

      <section>
        <h2>1. 목적과 적용</h2>
        <p>이 약관은 빵밭과 이용자 사이의 권리, 의무 및 책임사항에 적용됩니다. 이용자가 서비스에 가입하거나 이용하면 약관에 동의한 것으로 봅니다.</p>
      </section>

      <section>
        <h2>2. 계정과 회원 정보</h2>
        <p>이용자는 정확한 정보를 제공하고 자신의 계정을 안전하게 관리해야 합니다. 타인의 계정을 사용하거나 계정을 양도·대여해서는 안 됩니다.</p>
      </section>

      <section>
        <h2>3. 제공하는 서비스</h2>
        <ul>
          <li>지도와 위치를 활용한 대전 빵집 탐색</li>
          <li>나만의 빵지도와 빵명록</li>
          <li>실시간 혼잡도 투표와 실시간 톡</li>
          <li>그 밖에 빵밭이 추가로 제공하는 기능</li>
        </ul>
      </section>

      <section>
        <h2>4. 위치 기반 기능</h2>
        <p>위치 권한은 이용자가 허용한 경우에만 사용합니다. 기기와 통신 환경에 따라 실제 위치와 차이가 있을 수 있으며, 위치 권한을 허용하지 않아도 지도 탐색 등 기본 기능을 이용할 수 있습니다.</p>
      </section>

      <section>
        <h2>5. 이용자의 의무</h2>
        <p>이용자는 허위 정보, 욕설, 광고, 타인의 권리 침해, 서비스 운영 방해, 비정상적인 자동 접근 등 법령과 건전한 이용 질서에 반하는 행위를 해서는 안 됩니다.</p>
      </section>

      <section>
        <h2>6. 이용자 게시물</h2>
        <p>빵명록과 실시간 톡 등 게시물에 대한 권리는 작성자에게 있습니다. 이용자는 서비스 제공과 노출에 필요한 범위에서 게시물 이용을 허락하며, 권리 침해 게시물은 신고 또는 운영 정책에 따라 제한될 수 있습니다.</p>
      </section>

      <section>
        <h2>7. 정보의 정확성과 서비스 변경</h2>
        <p>가게 정보, 혼잡도, 현장 소식은 공공데이터와 이용자 제보를 바탕으로 하므로 실제 상황과 다를 수 있습니다. 빵밭은 운영상 필요한 경우 기능을 변경하거나 일시 중단할 수 있으며 중요한 변경은 사전에 안내합니다.</p>
      </section>

      <section>
        <h2>8. 이용 제한과 계약 해지</h2>
        <p>약관이나 운영 정책을 위반하면 게시물 삭제, 기능 제한 또는 이용계약 해지 조치가 이루어질 수 있습니다. 이용자는 언제든지 회원 탈퇴를 요청할 수 있습니다.</p>
      </section>

      <section>
        <h2>9. 책임의 범위</h2>
        <p>천재지변, 통신 장애, 제3자 서비스 장애 등 합리적으로 통제하기 어려운 사유로 발생한 손해에 대해서는 관련 법령이 허용하는 범위에서 책임이 제한될 수 있습니다.</p>
      </section>

      <section>
        <h2>10. 준거법과 분쟁 해결</h2>
        <p>이 약관은 대한민국 법령에 따라 해석됩니다. 분쟁이 발생하면 상호 협의를 우선하며, 해결되지 않는 경우 관련 법령이 정한 관할 법원에서 해결합니다.</p>
      </section>

      <section>
        <h2>11. 서비스 문의</h2>
        <p>서비스 이용 관련 문의는 빵밭 운영팀 이메일 <a href="mailto:bbangbat.team@gmail.com">bbangbat.team@gmail.com</a>으로 접수할 수 있습니다.</p>
      </section>
    </main>
  );
}

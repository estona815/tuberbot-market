import Link from "next/link";
import { Brand } from "@/components/brand";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <Brand compact />
          <p>유튜버 탐색부터 조건 합의, 제작 검수까지 연결하는 광고 거래 플랫폼입니다.</p>
          <small>공개 프리뷰의 결제는 샌드박스이며 실제 청구·지급이 발생하지 않습니다.</small>
        </div>
        <nav aria-label="하단 정책 메뉴">
          <Link href="/how-it-works">이용 방법</Link>
          <Link href="/safety">거래 안전</Link>
          <Link href="/legal/terms">이용약관</Link>
          <Link href="/legal/privacy">개인정보 처리방침</Link>
          <Link href="/legal/refunds">취소·환불</Link>
        </nav>
      </div>
    </footer>
  );
}

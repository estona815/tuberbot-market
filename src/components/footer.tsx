import Link from "next/link";
import { Brand } from "@/components/brand";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <Brand compact />
          <p>유튜브 광고 거래 조건과 진행 기록을 관리하는 제품을 준비 중입니다.</p>
        </div>
        <nav aria-label="하단 정책 메뉴">
          <Link href="/legal/terms">이용약관</Link>
          <Link href="/legal/privacy">개인정보 처리방침</Link>
          <Link href="/legal/refunds">취소·환불</Link>
          <Link href="/legal/prohibited-content">금지 광고</Link>
        </nav>
      </div>
    </footer>
  );
}

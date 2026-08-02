import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found page-shell">
      <span>404</span>
      <h1>요청한 페이지를 찾을 수 없습니다.</h1>
      <p>주소가 바뀌었거나 공개되지 않은 화면일 수 있습니다.</p>
      <div><Link className="button" href="/">홈으로</Link><Link className="button button--secondary" href="/market">광고 상품 찾기</Link></div>
    </div>
  );
}

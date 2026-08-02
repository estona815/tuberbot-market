import Link from "next/link";

export default function LegacyChannelNotFound() {
  return (
    <div className="not-found page-shell">
      <span>보존 자료 없음</span>
      <h1>확인되지 않은 레거시 채널입니다.</h1>
      <p>요청한 ID와 일치하는 공개 원본 자료를 이번 감사 범위에서 확인하지 못했습니다. 다른 유튜버 정보로 대체하지 않습니다.</p>
      <div><Link className="button" href="/search">유튜버 목록</Link><Link className="button button--secondary" href="/">홈으로</Link></div>
    </div>
  );
}

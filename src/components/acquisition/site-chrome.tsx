"use client";
import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { CloseIcon, MenuIcon } from "@/components/icons";
import s from "./acquisition.module.css";
const navigation = [["유튜버 찾기","/search"],["예산 계산","/budget"],["이용 안내","/guide"]] as const;
export function CustomerHeader() {
  const [open,setOpen]=useState(false);
  return <header className="site-header" style={{ background:"rgba(255,255,255,.97)" }}><div className="site-header__inner" style={{ maxWidth:1180 }}><Brand /><nav className="desktop-nav" aria-label="주요 메뉴">{navigation.map(([label,href]) => <Link key={href} href={href}>{label}</Link>)}<Link className={s.primary} href="/inquiry">광고 문의</Link></nav><div className="mobile-nav__actions"><Link href="/inquiry">광고 문의</Link><button className="icon-button" type="button" aria-label={open ? "메뉴 닫기" : "메뉴 열기"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <CloseIcon /> : <MenuIcon />}</button></div></div>{open && <nav className="mobile-nav" aria-label="모바일 메뉴">{navigation.map(([label,href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}<Link href="/inquiry" onClick={() => setOpen(false)}>광고 문의</Link></nav>}</header>;
}
export function CustomerFooter() {
  return <footer className="footer" style={{ background:"#f5f7fa",borderTop:"1px solid #e2e7ed" }}><div className="footer__inner" style={{ maxWidth:1180 }}><div><Brand compact /><p>채널 탐색부터 광고 예산 기획과 문의까지.</p><small>자체 기준 예상 예산은 특정 채널의 확정 가격이 아닙니다.<br />현재 온라인 결제·지급은 제공하지 않습니다.</small><p style={{ fontSize:12 }}>문의 접수 담당 권준 · <a href="mailto:kwonj0815@gmail.com">kwonj0815@gmail.com</a></p></div><nav aria-label="하단 메뉴"><Link href="/guide">이용 안내</Link><Link href="/inquiry-privacy">개인정보 안내</Link><Link href="/inquiry">광고 문의</Link><Link href="/workspace">캠페인 관리 체험</Link><Link href="/rate-studio">상세 계산 도구</Link><Link href="/launch">운영 연결 상태</Link></nav></div></footer>;
}
export function CustomerGuide() {
  return <div className={s.scope}><div className={`${s.wrap} ${s.policy}`}><header className={s.title}><h1>캠페인 준비, 이렇게 시작하세요.</h1><p>예산 기획과 문의는 간단하게, 진행 조건은 명확하게.</p></header>{[
    ["1. 콘텐츠와 희망 예산 정하기","쇼츠, 롱폼 PPL, 브랜디드 영상 중 필요한 형식을 고르고 희망 규모·수량·사용 범위를 설정하세요. 표시 금액은 자체 기준으로 계산한 기획 예산이며 채널 판매가가 아닙니다."],
    ["2. 관심 채널과 문의 접수","채널을 문의에 담거나 브랜드와 캠페인 목표만 남겨도 됩니다. 문의는 튜버봇 운영팀으로 전달되며 유튜버에게 자동 발송되지 않습니다."],
    ["3. 제작 범위와 최종 제안 확인","진행 가능한 채널, 일정, 제작물, 수정 횟수, 광고 표시와 사용권을 확인합니다. 목록에 있는 채널의 입점·제휴·섭외가 보장되는 것은 아닙니다."],
    ["4. 필요한 기록 보관","예산 기획안은 텍스트 파일로 내려받을 수 있습니다. 캠페인 관리 체험에서는 조건 버전과 검수 흐름도 확인할 수 있습니다. 해당 체험은 실제 계약·결제·정산을 대신하지 않습니다."],
  ].map(([title,body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}<div className={s.actions}><Link href="/budget" className={s.primary}>내 예산 계산</Link><Link href="/inquiry" className={s.secondary}>광고 문의</Link></div></div></div>;
}

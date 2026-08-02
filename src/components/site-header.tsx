"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { CloseIcon, MenuIcon } from "@/components/icons";

const links = [
  ["유튜버 찾기", "/search"],
  ["광고 상품", "/market"],
  ["캠페인", "/campaigns"],
  ["거래 데모", "/deal-demo"],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Brand />
        <nav className="desktop-nav" aria-label="주요 메뉴">
          {links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          <Link className="button button--small" href="/for-creators">유튜버로 입점</Link>
        </nav>
        <div className="mobile-nav__actions">
          <Link href="/for-creators">유튜버로 입점</Link>
          <button
            aria-expanded={open}
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            className="icon-button"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="mobile-nav" aria-label="모바일 메뉴">
          {links.map(([label, href]) => (
            <Link href={href} key={href} onClick={() => setOpen(false)}>{label}</Link>
          ))}
          <Link href="/how-it-works" onClick={() => setOpen(false)}>이용 방법</Link>
          <Link href="/safety" onClick={() => setOpen(false)}>거래 안전 가이드</Link>
        </nav>
      ) : null}
    </header>
  );
}

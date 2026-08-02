"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { CloseIcon, MenuIcon } from "@/components/icons";

const links = [
  ["광고 상품", "/market"],
  ["캠페인", "/campaigns"],
  ["이용 방법", "/how-it-works"],
  ["안전 가이드", "/safety"],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Brand />
        <nav className="desktop-nav" aria-label="주요 메뉴">
          {links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          <Link className="button button--quiet button--small" href="/how-it-works">제품 안내</Link>
        </nav>
        <div className="mobile-nav__actions">
          <Link href="/how-it-works">제품 안내</Link>
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
          <Link href="/for-creators" onClick={() => setOpen(false)}>유튜버 화면 미리보기</Link>
        </nav>
      ) : null}
    </header>
  );
}

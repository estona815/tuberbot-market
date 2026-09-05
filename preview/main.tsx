import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RateStudio } from "../src/components/ad-rate/rate-studio";
import { PlayIcon } from "../src/components/icons";
import "../src/app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("애플리케이션 루트를 찾을 수 없습니다.");
createRoot(root).render(
  <StrictMode>
    <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <header className="site-header"><div className="site-header__inner"><a className="brand" href="#main-content" aria-label="튜버봇 계산 도구"><PlayIcon size={30} /><span>TUBERBOT</span></a><span>로컬 실행본 · v1</span></div></header>
    <main id="main-content"><RateStudio /></main>
  </StrictMode>,
);

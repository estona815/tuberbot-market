import { Component, Suspense, use, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import Home from "../src/app/page";
import Campaigns from "../src/app/campaigns/page";
import Launch from "../src/app/launch/page";
import CreatorPage from "../src/app/creators/[slug]/page";
import ChannelPage from "../src/app/channel/[id]/page";
import PackagePage from "../src/app/packages/[id]/page";
import CampaignPage from "../src/app/campaigns/[id]/page";
import { ProjectWorkspace } from "../src/components/workspace/project-workspace";
import { RateStudio } from "../src/components/ad-rate/rate-studio";
import { MarketExplorer } from "../src/components/market-explorer";
import { marketplacePackages } from "../src/lib/market-data";
import { InfoPage } from "../src/components/info-page";
import { legalSitePages, publicSitePages } from "../src/lib/site-pages";
import { SiteHeader } from "../src/components/site-header";
import { Footer } from "../src/components/footer";
import { DealFlowDemo } from "../src/components/deal-flow-demo";
import { CustomerDirectory } from "../src/components/acquisition/creator-directory";
import { BudgetCalculator } from "../src/components/acquisition/budget-calculator";
import { InquiryPage, InquiryPrivacyPage } from "../src/components/acquisition/inquiry";
import { CustomerGuide } from "../src/components/acquisition/site-chrome";
import Link from "./browser-link";
import { useRoute } from "./browser-navigation";
import "../src/app/globals.css";
import "../src/app/release-polish.css";

const pages = new Map<string,Promise<ReactNode>>();
function Resolved({ promise }: { promise: Promise<ReactNode> }) { return use(promise); }
class Boundary extends Component<{ children:ReactNode },{ error:boolean }> {
  override state={ error:false };
  static getDerivedStateFromError() { return { error:true }; }
  override componentDidCatch(_error:Error,_info:ErrorInfo) { void _error; void _info; }
  override render() { return this.state.error ? <div className="page-shell"><h1>페이지를 열지 못했습니다.</h1><p>주소를 확인하거나 홈으로 돌아가세요. 브라우저에 저장한 작업은 유지됩니다.</p><Link className="button" href="/">홈으로</Link></div> : this.props.children; }
}
function PendingAccount() { return <div className="page-shell"><h1>운영 계정 연결</h1><p>실제 계정·서버 협업 연결은 준비 중입니다. 광고 문의와 예산 계산은 로그인 없이 사용할 수 있습니다.</p><Link className="button" href="/inquiry">광고 문의</Link><Link className="button button--secondary" href="/workspace">캠페인 관리 체험</Link></div>; }
function Page({ route }: { route:string }) {
  const url=new URL(route,"https://tuberbot-review.netlify.app"), path=url.pathname.replace(/\/$/u,"") || "/";
  if (path === "/") return <Home />;
  if (path === "/budget") return <BudgetCalculator />;
  if (path === "/inquiry") return <InquiryPage />;
  if (["/inquiry-privacy","/privacy"].includes(path)) return <InquiryPrivacyPage />;
  if (["/guide","/how-it-works"].includes(path)) return <CustomerGuide />;
  if (path === "/workspace") return <ProjectWorkspace />;
  if (path === "/rate-studio") return <RateStudio />;
  if (["/search","/creators"].includes(path)) return <CustomerDirectory initialQuery={url.searchParams.get("q") ?? ""} />;
  if (path === "/market" || path.startsWith("/categories/")) return <MarketExplorer items={marketplacePackages} initialCategory="전체" initialFormat="전체" initialQuery={url.searchParams.get("q") ?? ""} />;
  if (path === "/campaigns") return <Campaigns />;
  if (path === "/campaigns/new") return <ProjectWorkspace />;
  if (path === "/launch") return <Launch />;
  if (["/account","/login","/signup","/workspace/connected"].includes(path)) return <PendingAccount />;
  if (path === "/deal-demo") return <DealFlowDemo />;
  const infoKey=path === "/terms" ? "/legal/terms" : path;
  const info=legalSitePages[infoKey] ?? publicSitePages[infoKey];
  if (info) return <InfoPage page={info} />;
  const parts=path.split("/");
  if (parts.length === 3 && parts[2] && ["creators","channel","packages","campaigns"].includes(parts[1] ?? "")) {
    if (!pages.has(path)) { const id=decodeURIComponent(parts[2]); pages.set(path,parts[1] === "creators" ? CreatorPage({ params:Promise.resolve({ slug:id }) }) : parts[1] === "channel" ? ChannelPage({ params:Promise.resolve({ id }) }) : parts[1] === "packages" ? PackagePage({ params:Promise.resolve({ id }) }) : CampaignPage({ params:Promise.resolve({ id }) })); }
    return <Suspense fallback={<p className="page-shell" role="status">페이지를 열고 있습니다.</p>}><Resolved promise={pages.get(path)!} /></Suspense>;
  }
  return <div className="page-shell"><h1>요청한 페이지를 찾지 못했습니다.</h1><Link className="button" href="/">홈으로 돌아가기</Link></div>;
}
function App() {
  const route=useRoute();
  return <><a className="skip-link" href="#main-content">본문으로 건너뛰기</a><SiteHeader /><main id="main-content"><Boundary key={route}><Page route={route} /></Boundary></main><Footer /></>;
}
const root=document.getElementById("root");
if (!root) throw new Error("화면 루트를 찾을 수 없습니다.");
createRoot(root).render(<App />);

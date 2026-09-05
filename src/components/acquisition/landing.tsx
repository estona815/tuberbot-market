import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { campaignBudget, budgetQuery, DEFAULT_BUDGET, type BudgetInput } from "@/domain/campaign-budget";
import { BudgetHero } from "./budget-calculator";
import { featuredLegacyCreators } from "@/lib/creator-data";
import { CreatorTile } from "./creator-directory";
import { FormatIcon } from "./format-icon";
import s from "./presentation.module.css";

const PLANS: { format: BudgetInput["format"]; title: string; description: string; scope: string[] }[] = [
  { format:"shorts", title:"짧고 선명한 쇼츠", description:"핵심 메시지를 짧은 영상으로", scope:["제품·서비스 핵심 장면 구성","쇼츠 1편 기획","채널 게시 기준 예산"] },
  { format:"integration", title:"자연스럽게 연결하는 PPL", description:"기존 콘텐츠 안에 브랜드를 담기", scope:["롱폼 콘텐츠 내 제품 소개","PPL 1편 기획","채널 게시 기준 예산"] },
  { format:"branded", title:"브랜드를 위한 한 편", description:"브랜드 메시지 중심의 영상", scope:["브랜드 중심의 콘텐츠 구성","브랜디드 영상 1편 기획","채널 게시 기준 예산"] },
];
export function CampaignPlans() {
  return <><div className={s.plans}>{PLANS.map((plan) => {
    const input = { ...DEFAULT_BUDGET, format:plan.format }, result = campaignBudget(input);
    return <article className={s.plan} key={plan.format} data-format={plan.format}><div className={s.formatSignature}><FormatIcon format={plan.format} size={31} /><span>{plan.format === "shorts" ? "SHORT-FORM" : plan.format === "integration" ? "INTEGRATION" : "BRANDED"}</span></div><h3>{plan.title}</h3><p>{plan.description}</p><div className={s.planPrice}>{(Number(result.amountKrw)/10000).toLocaleString("ko-KR")}<small>만 원</small></div><p className={s.note}>자체 기준 예상 예산 · 부가세 별도</p><ul>{plan.scope.map((item) => <li key={item}>{item}</li>)}</ul><Link className={s.secondary} href={`/budget?${budgetQuery(input)}`}>내 조건에 맞춰 계산 <ArrowIcon size={15} /></Link></article>;
  })}</div><p className={s.note}>희망 규모 5만 명 · 라이프스타일 · 1편을 가정한 기획 예시입니다. 특정 채널의 확정 가격이나 판매 중인 패키지가 아닙니다.</p></>;
}
export function AcquisitionLanding() {
  return <div className={s.scope}>
    <div className={s.wrap}><section className={s.hero}>
      <div><h1>유튜버 광고,<br /><em>예산부터 쉽게.</em></h1><p className={s.lead}>브랜드에 맞는 채널을 찾고,<br />콘텐츠 조건에 맞는 예산을 바로 계산하세요.</p><div className={s.actions}><Link className={s.primary} href="/budget">내 광고 예산 계산 <ArrowIcon size={17} /></Link><Link className={s.secondary} href="/search">유튜버 둘러보기</Link></div><p className={s.heroNote}>회원가입 없이 계산하고, 기획안은 파일로 보관하세요.</p></div>
      <BudgetHero />
    </section><div className={s.miniFacts}><span><strong>조건을 바꾸면</strong> 예산도 바로 계산</span><span><strong>관심 채널과 함께</strong> 문의 내용 정리</span><span><strong>제작 범위까지</strong> 한 번에 기획</span></div></div>
    <section className={`${s.wrap} ${s.section}`}><header className={s.sectionHead}><div><h2>어떤 콘텐츠를 만들까요?</h2><p>형식별 기획 예산을 비교하고, 브랜드 조건으로 조정하세요.</p></div><Link className={s.textLink} href="/budget">전체 조건 설정 <ArrowIcon size={15} /></Link></header><CampaignPlans /></section>
    <div className={s.tinted}><section className={`${s.wrap} ${s.section}`}><header className={s.sectionHead}><div><h2>브랜드에 맞는 채널을 찾아보세요.</h2><p>음식부터 지식 콘텐츠까지, 관심 채널을 문의에 담을 수 있습니다.</p></div><Link className={s.textLink} href="/search">유튜버 전체 보기 <ArrowIcon size={15} /></Link></header><div className={s.creatorGrid}>{featuredLegacyCreators.map((creator) => <CreatorTile key={creator.legacyId} creator={creator} />)}</div><p className={s.note}>채널 탐색용 자료 · 2026.08.02 확인 자료 기준 · 목록 노출은 제휴·입점·섭외 확정을 뜻하지 않습니다.</p></section></div>
    <section className={`${s.wrap} ${s.section}`}><h2>광고 준비는, 세 단계로.</h2><div className={s.steps}>{[
      ["01","예산과 형식 정하기","희망 규모와 콘텐츠 수량을 바꿔보며 기획안을 만드세요."],
      ["02","관심 채널과 문의 남기기","브랜드와 캠페인 목표를 적어 튜버봇 운영팀에 전달하세요."],
      ["03","진행 조건 확인하기","채널 섭외, 제작 범위, 일정과 최종 금액을 확인한 뒤 진행합니다."],
    ].map(([number,title,description]) => <article className={s.step} key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <section className={`${s.wrap} ${s.section} ${s.faq}`}><h2>시작 전에<br />궁금한 점.</h2><div>
      <details><summary>표시되는 금액으로 바로 구매하는 건가요?</summary><p>아닙니다. 초기 기획에 사용할 수 있도록 튜버봇이 정한 계산 기준의 예상 예산입니다. 특정 채널의 판매가가 아니며, 온라인 결제는 제공하지 않습니다. 진행 전 최종 제안 내용을 확인합니다.</p></details>
      <details><summary>문의하면 선택한 유튜버에게 바로 보내지나요?</summary><p>문의는 튜버봇 운영팀으로 접수됩니다. 채널에 자동으로 발송되지 않으며, 목록에 있는 채널의 제휴나 섭외 가능 여부가 확정된 것은 아닙니다.</p></details>
      <details><summary>예산 기획안을 따로 보관할 수 있나요?</summary><p>예산 계산 화면에서 기획안 파일을 받을 수 있습니다. 조건 링크에는 이메일이나 상담 내용을 넣지 않습니다. 같은 조건으로 다시 계산하거나 내부 검토 자료로 활용하세요.</p></details>
      <details><summary>제작물과 계약 조건도 관리할 수 있나요?</summary><p>별도의 캠페인 관리 체험 화면에서 조건 버전, 계약 검토본, 콘텐츠 검수와 정산 준비 흐름을 확인할 수 있습니다. 체험 화면은 해당 브라우저에만 저장되며 실제 전자계약·결제를 대신하지 않습니다.</p></details>
    </div></section>
    <section className={`${s.wrap} ${s.cta}`}><div><h2>준비 중인 캠페인이 있나요?</h2><p>브랜드와 목표만 있어도 문의를 시작할 수 있습니다.</p></div><Link className={s.primary} href="/inquiry">광고 문의 남기기 <ArrowIcon size={17} /></Link></section>
  </div>;
}

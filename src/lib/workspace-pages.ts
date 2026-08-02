export type WorkspacePage = {
  title: string;
  description: string;
  group: "시작" | "유튜버" | "광고주" | "주문" | "계정" | "운영";
  status: string;
  items: readonly Readonly<{ label: string; detail: string }>[];
  action: Readonly<{ label: string; href: string }>;
};

const pages: Readonly<Record<string, WorkspacePage>> = {
  onboarding: {
    title: "내 역할 설정",
    description: "한 계정에서 유튜버, 광고주와 대행사 역할을 함께 사용할 수 있습니다.",
    group: "시작", status: "샌드박스 온보딩",
    items: [{ label: "역할 선택", detail: "업무에 필요한 역할만 먼저 활성화합니다." }, { label: "약관 동의", detail: "문서 버전과 동의 시점을 별도 기록합니다." }, { label: "프로필 설정", detail: "공개 정보와 거래 전용 정보를 구분합니다." }],
    action: { label: "유튜버로 시작", href: "/onboarding/creator" },
  },
  "onboarding/creator": {
    title: "유튜버 온보딩",
    description: "채널 소유 확인과 판매자 확인은 별도의 검증 단계입니다.",
    group: "유튜버", status: "인증 provider 연결 대기",
    items: [{ label: "프로필", detail: "공개 이름과 활동 카테고리를 설정합니다." }, { label: "채널 소유 확인", detail: "최소 OAuth scope 또는 검증 가능한 대체 방식이 필요합니다." }, { label: "판매자 확인", detail: "지급 전 PG seller verification을 완료해야 합니다." }],
    action: { label: "채널 인증 보기", href: "/verification/channel" },
  },
  "onboarding/advertiser": {
    title: "광고주 온보딩",
    description: "개인, 사업자 또는 대행사 조직을 만들고 거래 담당자를 지정합니다.",
    group: "광고주", status: "사업자 검증 연결 대기",
    items: [{ label: "조직 유형", detail: "개인·개인사업자·법인·대행사를 구분합니다." }, { label: "담당자 권한", detail: "캠페인과 결제 권한을 최소 범위로 부여합니다." }, { label: "광고 정책", detail: "금지·규제 카테고리와 광고 표시 의무를 확인합니다." }],
    action: { label: "사업자 확인 보기", href: "/verification/business" },
  },
  "verification/channel": {
    title: "채널 소유 확인",
    description: "YouTube 계정 비밀번호를 받지 않고 최소 권한으로 채널 소유를 확인하도록 설계합니다.",
    group: "유튜버", status: "ENABLE_YOUTUBE_OAUTH=OFF",
    items: [{ label: "연결", detail: "승인된 OAuth client와 최소 scope가 필요합니다." }, { label: "출처", detail: "API 원천 데이터와 튜버봇 거래 데이터를 구분합니다." }, { label: "해제", detail: "사용자가 연결 해제와 삭제를 요청할 수 있어야 합니다." }],
    action: { label: "유튜버 대시보드", href: "/dashboard/creator" },
  },
  "verification/seller": {
    title: "판매자 확인",
    description: "지급 대상과 계좌 명의 확인은 계약된 PG provider에서 처리해야 합니다.",
    group: "유튜버", status: "LIVE PAYOUT BLOCKED",
    items: [{ label: "판매자 등록", detail: "개인·사업자 유형별 필수 서류가 다릅니다." }, { label: "KYC 상태", detail: "provider 상태를 canonical 조회로 확인합니다." }, { label: "지급 차단", detail: "검증 완료 전 payout 요청을 거부합니다." }],
    action: { label: "지급 내역 보기", href: "/dashboard/creator/payouts" },
  },
  "verification/business": {
    title: "사업자 확인",
    description: "사업자 정보는 거래와 세무 목적에 필요한 최소 범위로 처리합니다.",
    group: "광고주", status: "외부 검증 연결 대기",
    items: [{ label: "사업자 유형", detail: "개인사업자와 법인사업자를 구분합니다." }, { label: "민감정보", detail: "등록번호 원문은 암호화하고 화면과 로그에서 마스킹합니다." }, { label: "조직 권한", detail: "검증 결과는 해당 조직 범위에서만 접근합니다." }],
    action: { label: "광고주 대시보드", href: "/dashboard/advertiser" },
  },
  "dashboard/creator": {
    title: "유튜버 대시보드",
    description: "상품, 제안, 제작 일정과 지급 준비 상태를 확인합니다.",
    group: "유튜버", status: "SANDBOX",
    items: [{ label: "광고 상품", detail: "공개 전 검토 상태와 예약 가능 일정을 관리합니다." }, { label: "받은 제안", detail: "제안과 역제안 버전을 비교합니다." }, { label: "지급 준비", detail: "판매자 검증·분쟁·대사 차단 상태를 함께 확인합니다." }],
    action: { label: "상품 관리", href: "/dashboard/creator/packages" },
  },
  "dashboard/creator/packages": {
    title: "광고 상품 관리",
    description: "유튜버가 직접 정한 가격과 콘텐츠 조건을 관리합니다.",
    group: "유튜버", status: "개발 seed 3개",
    items: [{ label: "공개 상품", detail: "채널·판매자 검증 조건을 통과해야 게시할 수 있습니다." }, { label: "사용권", detail: "채널 게시와 2차 사용 범위를 분리합니다." }, { label: "예약", detail: "제작 가능 기간과 동시 주문 한도를 관리합니다." }],
    action: { label: "새 상품", href: "/dashboard/creator/packages/new" },
  },
  "dashboard/creator/packages/new": {
    title: "새 광고 상품",
    description: "형식, 가격, 일정, 수정 범위와 사용권 조건을 구조화합니다.",
    group: "유튜버", status: "초안 저장",
    items: [{ label: "기본 조건", detail: "광고 형식과 시작 가격을 설정합니다." }, { label: "제작 범위", detail: "납기와 포함 수정 횟수를 정의합니다." }, { label: "권리", detail: "게시·재사용·편집·유료 매체 권리를 구분합니다." }],
    action: { label: "상품 관리로", href: "/dashboard/creator/packages" },
  },
  "dashboard/creator/availability": {
    title: "예약 가능 일정", description: "제작 가능 기간과 동시 주문 한도를 관리합니다.", group: "유튜버", status: "SANDBOX", items: [{ label: "가능 일정", detail: "주문 제안에 표시할 제작 가능일입니다." }, { label: "휴식 기간", detail: "제안을 받지 않을 기간을 설정합니다." }, { label: "동시 작업", detail: "과도한 예약을 막기 위한 한도입니다." }], action: { label: "유튜버 대시보드", href: "/dashboard/creator" },
  },
  "dashboard/creator/proposals": {
    title: "받은 광고 제안", description: "가격·일정·사용권 변경을 버전별로 비교합니다.", group: "유튜버", status: "SANDBOX", items: [{ label: "새 제안", detail: "아직 수락하지 않은 광고주 제안입니다." }, { label: "역제안", detail: "변경한 조건과 이유를 기록합니다." }, { label: "수락", detail: "양측 수락 후 계약 스냅샷을 생성합니다." }], action: { label: "주문 작업방", href: "/orders/TBM-20260802-001" },
  },
  "dashboard/creator/payouts": {
    title: "지급 내역", description: "지급 가능액, 차단 사유와 provider 상태를 확인합니다.", group: "유튜버", status: "PAYOUT_MODE: SANDBOX", items: [{ label: "지급 준비", detail: "판매자 검증, 구매 확정과 대사가 모두 필요합니다." }, { label: "보류", detail: "분쟁이나 대사 불일치 시 지급을 차단합니다." }, { label: "지급 완료", detail: "provider event와 원장 거래를 대사합니다." }], action: { label: "판매자 확인", href: "/verification/seller" },
  },
  "dashboard/advertiser": {
    title: "광고주 대시보드", description: "캠페인, 제안, 콘텐츠 검수와 결제 상태를 관리합니다.", group: "광고주", status: "SANDBOX", items: [{ label: "캠페인", detail: "공개 모집과 초안 상태를 확인합니다." }, { label: "주문 검수", detail: "제출물 버전과 수정 횟수를 확인합니다." }, { label: "결제", detail: "계약 수락 후에만 PG 결제를 시작합니다." }], action: { label: "캠페인 관리", href: "/dashboard/advertiser/campaigns" },
  },
  "dashboard/advertiser/campaigns": {
    title: "내 캠페인", description: "캠페인별 모집과 유튜버별 child order를 관리합니다.", group: "광고주", status: "개발 seed", items: [{ label: "초안", detail: "아직 공개되지 않은 캠페인입니다." }, { label: "모집 중", detail: "유튜버 지원을 검토하는 캠페인입니다." }, { label: "선정", detail: "선정한 유튜버마다 별도 주문을 생성합니다." }], action: { label: "새 캠페인", href: "/campaigns/new" },
  },
  "dashboard/advertiser/shortlists": {
    title: "찜한 상품", description: "비공개 shortlist에서 비교 중인 유튜버와 상품을 확인합니다.", group: "광고주", status: "개인화 화면 · noindex", items: [{ label: "상품", detail: "조건을 저장한 광고 상품입니다." }, { label: "유튜버", detail: "공개 프로필에서 저장한 유튜버입니다." }, { label: "비교", detail: "가격 외 일정과 사용권을 함께 비교합니다." }], action: { label: "광고 상품 찾기", href: "/market" },
  },
  "dashboard/agency": {
    title: "대행사 대시보드", description: "조직 권한과 고객사별 캠페인 접근 범위를 분리합니다.", group: "광고주", status: "AGENCY PLAN: OFF", items: [{ label: "고객사", detail: "조직별 데이터 경계를 유지합니다." }, { label: "멤버", detail: "담당 업무에 맞는 최소 권한을 부여합니다." }, { label: "청구", detail: "결제·세무 정보는 BILLING 권한으로 제한합니다." }], action: { label: "캠페인 보기", href: "/campaigns" },
  },
  messages: {
    title: "메시지", description: "문의와 주문 대화를 거래 기록 안에 남깁니다.", group: "주문", status: "민감정보 보호", items: [{ label: "주문 전 문의", detail: "상품 범위와 일정을 확인합니다." }, { label: "주문 작업방", detail: "계약 후 대화와 파일을 주문에 연결합니다." }, { label: "안전 안내", detail: "외부 결제 유도와 계좌정보 공유를 경고합니다." }], action: { label: "주문 작업방", href: "/orders/TBM-20260802-001" },
  },
  licenses: {
    title: "콘텐츠 사용권", description: "계약된 게시·재사용·편집·매체 범위와 만료를 확인합니다.", group: "주문", status: "ENABLE_LICENSE_RENEWALS=OFF", items: [{ label: "활성", detail: "현재 사용 가능한 권리 범위입니다." }, { label: "만료 예정", detail: "갱신 전 사전 알림 대상입니다." }, { label: "만료", detail: "추가 사용에는 새 합의가 필요합니다." }], action: { label: "계약 보기", href: "/orders/TBM-20260802-001/contract" },
  },
  reviews: {
    title: "거래 후기", description: "완료 거래의 당사자만 후기를 작성할 수 있습니다.", group: "주문", status: "PUBLIC REVIEWS: OFF", items: [{ label: "작성 가능", detail: "COMPLETED 주문만 후기를 열 수 있습니다." }, { label: "양방향", detail: "광고주와 유튜버의 평가 항목이 다릅니다." }, { label: "이의제기", detail: "신고, 검토와 소명 기록을 보존합니다." }], action: { label: "후기 정책", href: "/legal/reviews" },
  },
  notifications: {
    title: "알림", description: "거래의 다음 행동과 위험 상태를 안내합니다.", group: "계정", status: "인앱 알림 설계", items: [{ label: "계약·결제", detail: "수락과 결제 필요 상태를 알립니다." }, { label: "제작·검수", detail: "초안, 수정 요청과 게시 일정을 알립니다." }, { label: "분쟁·지급", detail: "차단과 결과를 양측에 알립니다." }], action: { label: "알림 설정", href: "/settings/profile" },
  },
  "settings/profile": {
    title: "프로필 설정", description: "공개 프로필과 거래 담당 정보를 분리해 관리합니다.", group: "계정", status: "SANDBOX", items: [{ label: "공개 정보", detail: "검색에 노출되는 이름과 소개입니다." }, { label: "거래 정보", detail: "계약과 지원을 위한 비공개 정보입니다." }, { label: "삭제 요청", detail: "계정과 연결 데이터 삭제 요청 경로입니다." }], action: { label: "대시보드", href: "/dashboard" },
  },
  "settings/security": {
    title: "보안 설정", description: "활성 세션, 연결 계정과 단계별 인증 상태를 관리합니다.", group: "계정", status: "관리자 2FA 필수", items: [{ label: "세션", detail: "다른 기기 세션을 확인하고 해제합니다." }, { label: "2단계 인증", detail: "관리자 역할에는 필수입니다." }, { label: "보안 알림", detail: "민감한 계정 변경을 별도 통지합니다." }], action: { label: "연결 계정", href: "/settings/connected-accounts" },
  },
  "settings/verification": {
    title: "인증 상태", description: "채널, 판매자와 사업자 확인 상태를 따로 표시합니다.", group: "계정", status: "외부 provider 대기", items: [{ label: "채널", detail: "채널 소유 상태입니다." }, { label: "판매자", detail: "지급 가능한 seller 상태입니다." }, { label: "사업자", detail: "광고주 조직의 확인 상태입니다." }], action: { label: "채널 인증", href: "/verification/channel" },
  },
  "settings/connected-accounts": {
    title: "연결 계정", description: "OAuth 연결 범위와 마지막 갱신일을 확인하고 해제합니다.", group: "계정", status: "YOUTUBE OAUTH: OFF", items: [{ label: "최소 권한", detail: "필요한 scope만 요청합니다." }, { label: "토큰", detail: "서버에서 암호화해 저장하고 로그에 남기지 않습니다." }, { label: "연결 해제", detail: "provider revoke와 로컬 삭제를 함께 처리합니다." }], action: { label: "보안 설정", href: "/settings/security" },
  },
};

const orderSections: Readonly<Record<string, string>> = {
  contract: "계약 조건",
  deliverables: "제출물",
  payment: "결제 상태",
  dispute: "분쟁 접수",
};

const adminTitles: Readonly<Record<string, string>> = {
  users: "사용자", organizations: "조직", creators: "유튜버", "channel-claims": "채널 인증", "seller-verifications": "판매자 확인", packages: "광고 상품", campaigns: "캠페인", orders: "주문", payments: "결제", refunds: "환불", payouts: "지급", disputes: "분쟁", reviews: "후기", moderation: "콘텐츠 검토", risk: "위험 신호", fees: "수수료 규칙", "feature-flags": "기능 플래그", reconciliation: "대사", audit: "감사 로그", "system-health": "시스템 상태",
};

export function getWorkspacePage(slug: readonly string[]): WorkspacePage | undefined {
  const path = slug.join("/");
  const exact = pages[path];
  if (exact) return exact;
  const [first, second, third] = slug;
  if (slug.length === 3 && first === "orders" && second !== undefined && third !== undefined && orderSections[third]) {
    const section = orderSections[third];
    return { title: section, description: `주문 ${second}의 ${section} 기록입니다.`, group: "주문", status: "SANDBOX ORDER", items: [{ label: "접근 범위", detail: "주문 당사자와 허용된 운영 역할만 조회해야 합니다." }, { label: "변경 기록", detail: "상태 변경은 이유, actor와 idempotency key를 남깁니다." }, { label: "감사 가능", detail: "계약·결제·분쟁 사건을 append-only event로 보존합니다." }], action: { label: "주문 작업방", href: `/orders/${encodeURIComponent(second)}` } };
  }
  if (slug.length === 2 && first === "admin" && second !== undefined && adminTitles[second]) {
    const title = adminTitles[second];
    return { title: `관리자 · ${title}`, description: `${title} 운영 화면은 관리자 2단계 인증, 최소 권한과 사유 입력을 전제로 합니다.`, group: "운영", status: "ADMIN 2FA REQUIRED", items: [{ label: "권한", detail: "업무 역할에 필요한 범위만 접근합니다." }, { label: "변경", detail: "민감한 작업에는 명시적인 이유가 필요합니다." }, { label: "감사 로그", detail: "actor, 대상, 이전·이후 상태와 시점을 append-only로 남깁니다." }], action: { label: "운영 개요", href: "/admin" } };
  }
  return undefined;
}

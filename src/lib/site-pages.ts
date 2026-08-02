export type SiteSection = {
  title: string;
  body: string;
  items?: readonly string[];
};

export type SitePage = {
  title: string;
  description: string;
  eyebrow: string;
  sections: readonly SiteSection[];
  primaryAction?: Readonly<{ label: string; href: string }>;
  note?: string;
  noIndex?: boolean;
};

export const publicSitePages: Readonly<Record<string, SitePage>> = {
  "how-it-works": {
    title: "조건 합의부터 검수까지, 준비 중인 흐름을 확인하세요.",
    description: "샘플 데이터로 상품 탐색, 계약, 콘텐츠 검수, 구매 확정과 정산 준비 화면을 미리 확인합니다.",
    eyebrow: "이용 방법",
    sections: [
      { title: "01 · 탐색과 제안", body: "광고 형식·예산·제작 기간·사용권을 비교한 뒤 구조화된 제안을 보냅니다.", items: ["한 주문에는 광고주 1곳과 유튜버 1명", "협상 내용은 제안 버전으로 보존"] },
      { title: "02 · 계약과 샌드박스 결제", body: "양측이 같은 계약 스냅샷을 수락한 다음 결제 단계로 이동합니다.", items: ["계약 금액과 수정 범위 고정", "현재 저장소는 실결제가 아닌 샌드박스만 지원"] },
      { title: "03 · 제작과 검수", body: "제출물 버전, 수정 요청, 최종 승인과 게시 증빙을 주문 기록에 남깁니다.", items: ["버전별 파일과 의견", "광고 표시 체크리스트"] },
      { title: "04 · 확정과 정산", body: "구매 확정 후 수수료 스냅샷과 복식 원장을 기준으로 지급 가능액을 계산합니다.", items: ["분쟁 중 지급 차단", "판매자 검증 전 지급 차단"] },
    ],
    primaryAction: { label: "광고 상품 찾기", href: "/market" },
  },
  safety: {
    title: "보호를 과장하지 않고, 거래 사실을 남깁니다.",
    description: "튜버봇 마켓은 계약·검수·분쟁 기록을 구조화합니다. 실제 PG 오픈마켓 지급대행 계약 전에는 보호 결제를 보장하지 않습니다.",
    eyebrow: "거래 안전 가이드",
    sections: [
      { title: "거래 전", body: "채널 소유와 판매자 정보를 별도로 확인하고, 계약 범위 밖의 구두 약속은 제안서에 반영합니다.", items: ["채널 인증과 판매자 검증은 서로 다른 상태", "계좌번호·비밀번호를 메시지로 전달하지 않기"] },
      { title: "제작 중", body: "초안과 수정 요청은 버전 단위로 기록하며 외부 결제 유도나 규제 카테고리는 추가 검토합니다.", items: ["광고 표시 문구 확인", "저작권·초상권·2차 사용권 확인"] },
      { title: "문제 발생 시", body: "분쟁 접수 즉시 지급을 차단하고 양측 증거, 계약 스냅샷과 작업 기록을 보존하도록 설계했습니다.", items: ["AI가 분쟁을 자동 판정하지 않음", "관리자 결정에는 이유와 감사 로그 필요"] },
    ],
    note: "LIVE_PAYMENT: BLOCKED_EXTERNAL · SAFE_PAYMENT_PUBLIC_BADGE: DISABLED",
    primaryAction: { label: "결제 역할 자세히 보기", href: "/legal/safe-payment" },
  },
  pricing: {
    title: "거래 조건은 투명하게, 수수료는 계약에 고정합니다.",
    description: "상품 가격은 유튜버가 정하고 플랫폼 수수료는 주문 계약 시점의 규칙을 스냅샷으로 보존합니다.",
    eyebrow: "가격과 수수료",
    sections: [
      { title: "유튜버 상품 가격", body: "콘텐츠 형식, 제작 범위, 수정 횟수와 사용권에 따라 유튜버가 시작 가격을 설정합니다." },
      { title: "플랫폼 수수료", body: "개발 기본 수수료는 판매자 기준 12%입니다. 실제 적용률·세금·PG 수수료는 외부 계약과 법무·세무 검토 후 확정됩니다." },
      { title: "추가 비용", body: "제품 배송, 유료 광고 소재 사용, 독점, 해외 사용, 원본 제공은 제안서에서 별도 합의합니다." },
    ],
    note: "예상 광고 단가와 CPV는 정책 감사 완료 전 비활성화되어 있습니다.",
  },
  "for-creators": {
    title: "유튜버용 광고 거래 화면을 미리 확인하세요.",
    description: "채널 인증, 상품 구성, 제안, 검수와 정산 준비의 예정 흐름을 보여주는 제품 프리뷰입니다.",
    eyebrow: "유튜버",
    sections: [
      { title: "상품 만들기", body: "형식·가격·제작 기간·수정 횟수·사용권을 명확히 정의합니다." },
      { title: "조건 협상", body: "제안과 역제안 버전이 남아 최종 계약과 달라지는 일을 줄입니다." },
      { title: "정산 준비", body: "판매자 검증과 지급 가능 상태를 분리해 확인하며, 분쟁 중에는 지급이 차단됩니다." },
    ],
    primaryAction: { label: "상품 화면 미리보기", href: "/market" },
  },
  "for-advertisers": {
    title: "광고주용 검색부터 검수까지 미리 확인하세요.",
    description: "상품 탐색, 캠페인 구성과 콘텐츠 검수의 예정 흐름을 보여주는 제품 프리뷰입니다.",
    eyebrow: "광고주",
    sections: [
      { title: "조건 비교", body: "가격뿐 아니라 광고 형식, 제작 기간, 수정 범위와 사용권을 함께 비교합니다." },
      { title: "캠페인 모집", body: "여러 유튜버를 모집하되 선정 후에는 유튜버별 child order를 생성합니다." },
      { title: "성과 기록", body: "UTM·쿠폰·광고주 first-party 데이터를 출처별로 구분하며 성과를 보장하지 않습니다." },
    ],
    primaryAction: { label: "캠페인 화면 미리보기", href: "/campaigns" },
  },
  "for-agencies": {
    title: "대행사용 캠페인 관리 구조를 미리 확인하세요.",
    description: "멤버 권한, 고객사별 캠페인과 주문 분리의 예정 구조를 보여주는 제품 프리뷰입니다.",
    eyebrow: "광고대행사",
    sections: [
      { title: "조직 권한", body: "OWNER, ADMIN, MEMBER, BILLING, VIEWER 권한으로 필요한 범위만 공유합니다." },
      { title: "고객사 분리", body: "캠페인·주문·성과 데이터는 조직 범위를 벗어나 조회할 수 없도록 설계합니다." },
      { title: "운영 지원", body: "매니지드 캠페인과 대행사 요금제는 후속 기능이며 현재는 신청 대기 상태입니다." },
    ],
    primaryAction: { label: "거래 흐름 미리보기", href: "/how-it-works" },
  },
  help: {
    title: "거래 단계별 도움을 확인하세요.",
    description: "계정, 상품, 계약, 제출물, 결제와 분쟁에 관한 기본 안내입니다.",
    eyebrow: "도움말",
    sections: [
      { title: "시작하기", body: "광고주의 상품 탐색·캠페인 구성과 유튜버의 채널 인증은 현재 제품 프리뷰로만 제공합니다." },
      { title: "결제·환불", body: "현재 결제는 샌드박스이며 실제 환불 규칙은 PG·법무 검토 후 버전으로 고정됩니다." },
      { title: "신고·분쟁", body: "주문 작업방의 분쟁 경로에서 사유와 증거를 제출하도록 설계되어 있습니다." },
    ],
    note: "운영 지원 연락처는 공개 전 필수 설정 항목입니다.",
  },
};

export const legalSitePages: Readonly<Record<string, SitePage>> = {
  terms: {
    title: "서비스 이용약관 초안",
    description: "튜버봇 마켓 계정과 서비스 이용에 관한 검토용 초안입니다.",
    eyebrow: "법률 문서 · 검토 전",
    sections: [
      { title: "적용 범위", body: "계정 생성, 공개 콘텐츠, 마켓 기능과 운영 조치의 기본 원칙을 설명합니다." },
      { title: "계정 책임", body: "사용자는 정확한 정보를 제공하고 인증 수단과 세션을 안전하게 관리해야 합니다." },
      { title: "운영 조치", body: "위법·금지 콘텐츠, 사기, 외부 결제 유도나 보안 위험이 확인되면 기능이 제한될 수 있습니다." },
    ],
    note: "법률 검토가 완료되지 않은 제품 초안입니다.",
    noIndex: true,
  },
  marketplace: {
    title: "마켓플레이스 판매자·구매자 약관 초안",
    description: "광고주, 유튜버와 플랫폼의 역할을 구분하기 위한 검토용 문서입니다.",
    eyebrow: "법률 문서 · 검토 전",
    sections: [
      { title: "거래 당사자", body: "광고 콘텐츠 거래의 당사자는 광고주와 유튜버이며, 튜버봇은 거래 도구와 기록을 제공합니다." },
      { title: "조건 확정", body: "양측이 수락한 계약 버전에는 금액, 일정, 수정, 게시, 광고 표시와 사용권 조건이 포함됩니다." },
      { title: "수수료", body: "완료 거래의 수수료는 계약 시점의 fee snapshot을 기준으로 원장에 기록합니다." },
    ],
    note: "플랫폼의 법적 지위와 책임 범위는 법률 검토가 필요합니다.",
    noIndex: true,
  },
  privacy: {
    title: "개인정보 처리방침 초안",
    description: "수집 목적, 보관 기간, 처리 위탁과 권리 행사 경로를 확정하기 위한 검토용 문서입니다.",
    eyebrow: "법률 문서 · 검토 전",
    sections: [
      { title: "최소 수집", body: "계정, 거래, 판매자 확인과 지급에 필요한 정보만 목적별로 분리해 처리합니다." },
      { title: "민감 정보", body: "계좌 원문을 직접 보관하지 않고 가능한 경우 PG의 seller ID 또는 token만 저장합니다." },
      { title: "사용자 권리", body: "연결 해제, 데이터 열람·정정·삭제 요청과 YouTube OAuth revoke 경로를 제공해야 합니다." },
    ],
    note: "처리자·위탁사·보관 기간·연락처는 운영 사업자 확인 후 확정해야 합니다.",
    noIndex: true,
  },
  refunds: {
    title: "취소·환불 정책 초안",
    description: "주문 단계와 실제 수행 범위를 기준으로 환불을 판단하기 위한 검토용 원칙입니다.",
    eyebrow: "정책 · 검토 전",
    sections: [
      { title: "자동 처리 가능", body: "결제 실패, 중복 결제, 미수락 주문과 provider가 명확히 취소한 결제는 자동 처리 후보입니다." },
      { title: "개별 검토", body: "제작이 시작된 주문의 환불은 계약 버전, 제출물과 양측 증거를 함께 검토합니다." },
      { title: "원장 처리", body: "환불은 원 결제수단을 우선하며 결제액을 초과할 수 없고 역분개 기록을 남깁니다." },
    ],
    note: "단계별 자동 환불 비율은 법무·PG 확인 전 확정하지 않습니다.",
    noIndex: true,
  },
  "prohibited-content": {
    title: "금지·제한 광고 안내",
    description: "플랫폼과 이용자를 보호하기 위해 거래를 받지 않거나 추가 검토하는 범주입니다.",
    eyebrow: "안전 정책",
    sections: [
      { title: "금지", body: "불법 제품·서비스, 사기, 도박, 가짜 명품, 조회수·구독자 조작 서비스는 거래할 수 없습니다." },
      { title: "추가 검토", body: "의료·건강, 금융, 주류 등 규제 가능성이 있는 범주는 기능 플래그가 기본 비활성입니다." },
      { title: "광고 표시", body: "경제적 이해관계, 제품 제공과 제휴 수익을 숨기는 요청은 허용하지 않습니다." },
    ],
    noIndex: true,
  },
  reviews: {
    title: "거래 후기 정책 초안",
    description: "실제 완료 거래의 당사자만 후기를 남기고 이의제기 기회를 제공하는 원칙입니다.",
    eyebrow: "정책 · 검토 전",
    sections: [
      { title: "작성 자격", body: "COMPLETED 상태의 주문 당사자만 해당 주문에 후기를 작성할 수 있습니다." },
      { title: "공개 기준", body: "공개 후기 기능은 기본 비활성이며 신고와 이의제기 절차가 준비된 뒤 활성화합니다." },
      { title: "운영 조치", body: "삭제·숨김에는 사유와 감사 기록이 필요하고, 평점이나 거래량을 만들지 않습니다." },
    ],
    noIndex: true,
  },
  "safe-payment": {
    title: "결제와 지급의 역할 안내",
    description: "튜버봇, 광고주, 유튜버와 PG가 맡는 역할을 구분합니다. 현재는 운영 결제가 연결되지 않았습니다.",
    eyebrow: "결제 안내",
    sections: [
      { title: "결제 시점", body: "양측이 같은 계약 스냅샷을 수락한 뒤 광고주가 PG 결제를 진행하도록 설계합니다." },
      { title: "제작 시작", body: "서버가 PG의 canonical payment를 확인하고 FUNDED 이벤트를 기록한 뒤에만 제작을 시작합니다." },
      { title: "구매 확정과 지급", body: "게시 증빙과 광고주 확인 후 판매자 검증·분쟁·대사 상태를 점검하고 지급을 요청합니다." },
      { title: "플랫폼과 PG", body: "튜버봇은 거래 상태와 원장을 관리하고, 실제 자금 이동은 계약된 PG가 수행해야 합니다. 튜버봇이 임의로 자금을 보관하지 않습니다." },
    ],
    note: "PG 오픈마켓 지급대행 계약과 법률 검토 전에는 ‘안전결제’ 공개 배지가 비활성입니다.",
    noIndex: true,
  },
};

# Permission matrix

기호: `R` read, `W` create/update own scope, `A` 승인/결정, `—` 접근 없음. 모든 허용은 active session, object/org scope, runtime validation을 전제로 한다. 역할을 여러 개 가져도 자동으로 전역 권한이 생기지 않는다.

| Resource/action | Advertiser/Agency | Creator | Support | Finance | Risk | Moderator | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 공개 creator/package/campaign | R/W own campaign | R/W own profile/package | R | R | R | R | R |
| channel claim/verification | request own | request own | R/A assigned | — | R/A risk | R public | A |
| organization/member | W own org (owner rules) | W own org | R minimal | R billing minimal | R risk minimal | — | A; role elevation audited |
| proposal/contract | R/W participating; accept own | R/W participating; accept own | R assigned | R amounts | R hold case | — | R; no impersonated acceptance |
| order room/messages/files | R/W party | R/W party | R assigned dispute/support | R payment metadata only | R assigned risk | R reported content only | R exceptional, reason required |
| payment create/confirm | W buyer only | R status | R status | R/A refund policy | R/hold | — | no raw card; exceptional action audited |
| refund | request own | request/consent own | recommend | A within limit, dual approval above threshold | hold/A fraud input | — | emergency A + reason/dual control |
| seller verification/account | — | W own via provider; R masked | R status | R provider token/masked | A hold | — | R masked; no raw bank by default |
| payout | — | R own status | R status | A dispatch/retry after guards | A hold/release own risk case | — | cannot bypass guard; exceptional audited |
| ledger/reconciliation | own receipt summary | own payout summary | — | R/A run/resolve | R mismatch/hold | — | R; posted mutation impossible |
| dispute/evidence/decision | R/W party evidence | R/W party evidence | A assigned first decision | R/refund execution | A assigned risk | — | A appeal only with separation |
| review/report/appeal | W completed own | W completed own | R case | — | R abuse | A moderation decision | R/A appeal, reason |
| fee rules/feature flags | — | — | — | R/propose fee | R risk flags | R moderation flags | A; version/reason/audit |
| audit logs | own activity subset | own activity subset | R assigned | R finance subset | R risk subset | R moderation subset | R controlled; no update/delete |

## Object checks

Advertiser/creator access에는 `order.party_user_id` 또는 organization membership, campaign/package ownership, conversation membership를 별도로 확인한다. 추측 가능한 ID를 possession proof로 쓰지 않는다. file URL 발급 시 order membership과 file classification을 재검증한다.

## Separation of duties

- Support는 payout을 실행하거나 ledger를 수정하지 않는다.
- Finance는 dispute 사실을 임의 판정하지 않고 승인된 decision만 실행한다.
- Risk hold 해제와 고액 payout/환불 실행을 동일 인물이 단독 수행하지 않는다.
- Moderator는 결제/계약/비공개 전체 주문을 볼 수 없다.
- Admin도 accepted contract, posted ledger, provider event를 수정할 수 없다.

권한 변경은 target user, old/new roles, scope, requester/approver, reason, expiry를 audit한다. 임시 권한은 자동 만료한다. 각 matrix cell은 API integration test로 최소 allow 1개/deny 1개를 가진다.

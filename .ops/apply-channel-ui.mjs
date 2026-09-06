import {readFile,writeFile} from 'node:fs/promises';
async function replace(file,before,after,count=1){const text=await readFile(file,'utf8');if(text.split(before).length-1!==count)throw new Error(`Ambiguous patch: ${file}`);await writeFile(file,text.replaceAll(before,after));}
await replace('review/main.tsx','import Link from "./browser-link";','import { ChannelDataStatusPage } from "../src/components/channels/channel-data-ui";\nimport Link from "./browser-link";');
await replace('review/main.tsx','if (path === "/budget") return <BudgetCalculator />;','if (path === "/budget") return <BudgetCalculator />;\n  if (path === "/data-status") return <ChannelDataStatusPage />;');
await replace('src/components/acquisition/landing.tsx','import { CreatorTile } from "./creator-directory";','import { CreatorTile } from "./creator-directory";\nimport { ChannelUpdateNotice } from "@/components/channels/channel-data-ui";');
await replace('src/components/acquisition/landing.tsx','<p className={s.note}>채널 탐색용 자료 · 2026.08.02 확인 자료 기준 · 목록 노출은 제휴·입점·섭외 확정을 뜻하지 않습니다.</p>','<ChannelUpdateNotice /><p className={s.note}>채널별 확인 시각과 출처를 표시합니다. 목록 노출은 제휴·입점·섭외 확정을 뜻하지 않습니다.</p>');
await replace('src/components/acquisition/site-chrome.tsx','<Link href="/launch">운영 연결 상태</Link>','<Link href="/data-status">데이터 업데이트</Link><Link href="/launch">운영 연결 상태</Link>');
await replace('src/components/acquisition/creator-directory.tsx','const { catalog } = useChannelCatalog();','const { catalog, nowMs } = useChannelCatalog();',2);
await replace('src/components/acquisition/creator-directory.tsx','const { catalog } = useChannelCatalog(creator.youtubeId);','const { catalog, nowMs } = useChannelCatalog(creator.youtubeId);');
await replace('src/components/acquisition/creator-directory.tsx','usableRecord(catalog?.records.find((item) => item.youtubeId === creator.youtubeId))','usableRecord(catalog?.records.find((item) => item.youtubeId === creator.youtubeId), nowMs)',2);
await replace('src/components/acquisition/creator-directory.tsx','usableRecord(record)])','usableRecord(record, nowMs)])');
await replace('src/components/acquisition/creator-directory.tsx','[deferred,category,sort,savedOnly,shortlist.ids,catalog]','[deferred,category,sort,savedOnly,shortlist.ids,catalog,nowMs]');
await replace('netlify/functions/channel-data.ts','export default async (request: Request, context: Context) => {','export default async function channelData(request: Request, context: Context) {');
await replace('netlify/functions/channel-data.ts','\n};\nexport const config','\n}\nexport const config');
await replace('netlify/functions/youtube-daily.ts','export default async (_request: Request, context: Context) => {','export default async function youtubeDaily(_request: Request, context: Context) {');
await replace('netlify/functions/youtube-daily.ts','\n};\nexport const config','\n}\nexport const config');
await writeFile('.env.example',(await readFile('.env.example','utf8'))+'\n# Public read-only channel cache. Keep the API key in Netlify Functions secrets.\n# Daily 03:10 KST; on-view refresh after 6h. False stops Google calls, not retention cleanup.\nYOUTUBE_SYNC_ENABLED=true\n');
console.log('Applied bounded channel data UI integration; existing planning model unchanged.');

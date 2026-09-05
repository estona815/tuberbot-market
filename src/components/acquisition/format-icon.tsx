import type { BudgetInput } from "@/domain/campaign-budget";
export function FormatIcon({ format, size = 28 }: { format: BudgetInput["format"]; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{format === "shorts" ? <><rect x="8" y="2.5" width="16" height="27" rx="4" /><path d="m14 11 6 5-6 5z" /><path d="M14 26h4" /></> : <><rect x="2.5" y="6" width="27" height="20" rx="4" /><path d="m13 11 7 5-7 5z" />{format === "branded" && <path d="M7 2v3m18-3v3M7 27v3m18-3v3" />}</>}</svg>;
}

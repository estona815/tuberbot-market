import Link from "next/link";
import type { SitePage } from "@/lib/site-pages";

export function InfoPage({ page }: { page: SitePage }) {
  return (
    <div className="info-page page-shell">
      <header className="info-hero">
        <p>{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <span>{page.description}</span>
        {page.primaryAction ? <Link className="button" href={page.primaryAction.href}>{page.primaryAction.label}</Link> : null}
      </header>
      <div className="info-sections">
        {page.sections.map((section, index) => (
          <section key={section.title}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.items ? <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </div>
          </section>
        ))}
      </div>
      {page.note ? <aside className="info-note"><strong>현재 상태</strong><p>{page.note}</p></aside> : null}
    </div>
  );
}

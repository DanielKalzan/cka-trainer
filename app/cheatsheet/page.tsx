import PageHeader from "@/components/PageHeader";
import { CHEATSHEET } from "@/content/cheatsheet";

export default function CheatsheetPage() {
  return (
    <>
      <PageHeader
        title="Cheatsheet"
        subtitle="The muscle-memory set: if it's here, you should be able to type it cold."
      />
      <div className="columns-1 gap-4 lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
        {CHEATSHEET.map((section) => (
          <section key={section.id} className="rounded-xl border border-edge bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {section.title}
            </h2>
            <ul className="space-y-3">
              {section.items.map((item, i) => (
                <li key={i}>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-term-bg px-3 py-2 font-mono text-[13px] leading-relaxed text-term-green">
                    {item.cmd}
                  </pre>
                  {item.note ? (
                    <p className="mt-1 pl-1 text-xs leading-relaxed text-muted">{item.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

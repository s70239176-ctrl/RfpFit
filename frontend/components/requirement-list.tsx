import type { Verdict } from "@/lib/schema";

interface Parsed {
  id: string;
  text: string;
}

/** Split the sponsor's requirements text into per-ID lines for display. Falls back to the raw text. */
function splitRequirements(text: string, ids: string[]): Parsed[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Parsed[] = [];
  for (const id of ids) {
    const line = lines.find((l) => l.startsWith(id + " ") || l.startsWith(id + ":") || l.startsWith(id + "."));
    out.push({ id, text: line ? line.slice(id.length).replace(/^[\s:.\-]+/, "") : "" });
  }
  return out;
}

function mark(verdict: Verdict | null | undefined, id: string): "met" | "missing" | "unclear" | null {
  if (!verdict) return null;
  if (verdict.requirementsMet.includes(id)) return "met";
  if (verdict.requirementsMissing.includes(id)) return "missing";
  if (verdict.requirementsUnclear.includes(id)) return "unclear";
  return null;
}

const MARK_TEXT = { met: "Met", missing: "Missing", unclear: "Unclear" } as const;
const MARK_STYLE = { met: "text-good", missing: "text-bad", unclear: "text-partial" } as const;

export function RequirementList({
  text,
  ids,
  verdict,
}: {
  text: string;
  ids: string[];
  verdict?: Verdict | null;
}) {
  const items = splitRequirements(text, ids);
  const structured = items.every((i) => i.text);
  return (
    <section aria-label="Requirements">
      <h2 className="label mb-3">Frozen rubric</h2>
      {structured ? (
        <ol className="divide-y divide-rule rounded-lg border border-rule">
          {items.map((r) => {
            const m = mark(verdict, r.id);
            return (
              <li key={r.id} className="flex items-start gap-3 p-3">
                <span className="mt-0.5 rounded-sm bg-primary/15 px-1.5 py-0.5 font-mono text-xs text-primary">{r.id}</span>
                <span className="flex-1">{r.text}</span>
                {m && <span className={`text-xs font-medium uppercase tracking-wide ${MARK_STYLE[m]}`}>{MARK_TEXT[m]}</span>}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-lg border border-rule p-4">
          <p className="mb-3 flex flex-wrap gap-1.5">
            {ids.map((id) => {
              const m = mark(verdict, id);
              return (
                <span key={id} className="rounded-sm bg-primary/15 px-1.5 py-0.5 font-mono text-xs text-primary">
                  {id}
                  {m && <span className={`ml-1 ${MARK_STYLE[m]}`}>{MARK_TEXT[m]}</span>}
                </span>
              );
            })}
          </p>
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      )}
    </section>
  );
}

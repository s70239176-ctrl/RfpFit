import type { Rfp } from "@/lib/schema";

export function RfpHeader({ rfp }: { rfp: Rfp }) {
  return (
    <header className="mb-8">
      <p className="label">Brief #{rfp.id}</p>
      <h1 className="mt-2 text-4xl leading-tight">{rfp.title}</h1>
      <p className="mt-3 max-w-2xl text-muted">{rfp.summary}</p>
      <p className="mt-3 text-sm text-muted">
        {rfp.bidCount} {rfp.bidCount === 1 ? "bid" : "bids"} · {rfp.judgedCount} judged
      </p>
    </header>
  );
}

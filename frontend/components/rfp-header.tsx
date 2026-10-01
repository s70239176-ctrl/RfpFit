import Link from "next/link";
import type { Rfp } from "@/lib/schema";
import { Lifecycle } from "./lifecycle";
import { StatusChip, displayStatus } from "./status-chip";

export function RfpHeader({ rfp, nowMs }: { rfp: Rfp; nowMs: number }) {
  return (
    <header className="reveal space-y-5">
      <p className="label">
        <Link href="/" className="no-underline hover:text-fg">
          Briefs
        </Link>{" "}
        / #{rfp.id}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-4xl font-medium leading-[1.06] sm:text-5xl">{rfp.title}</h1>
          <p className="mt-3 text-muted">{rfp.summary}</p>
        </div>
        <StatusChip status={displayStatus(rfp, nowMs)} />
      </div>
      <Lifecycle rfp={rfp} nowMs={nowMs} />
    </header>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  message,
  action,
}: {
  message: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="panel flex flex-col items-start gap-4 p-6">
      <p className="text-muted">{message}</p>
      {action && (
        <Link href={action.href} className="btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="panel flex flex-col items-start gap-3 border-bad/40 p-6">
      <p className="text-bad">{message}</p>
      {onRetry && (
        <button type="button" className="btn-quiet" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

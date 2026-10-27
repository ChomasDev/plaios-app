import { formatDate } from "../../../shared/format.js";

export function ConversationDivider({ startedAt }: { startedAt: string }) {
  return <p className="flex items-center gap-4 text-xs text-muted-foreground">
    <span className="h-px flex-1 bg-border" />
    {formatDate(startedAt)}
    <span className="h-px flex-1 bg-border" />
  </p>;
}

import { Fragment, type ReactNode } from "react";

const LIST_ITEM = /^\s*([-*]|\d+\.)\s+/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const HEADING_CLASS = ["mt-8 mb-3 text-2xl font-semibold tracking-tight first:mt-0", "mt-8 mb-3 border-b pb-2 text-lg font-semibold", "mt-6 mb-2 font-semibold"];

/**
 * Renders the markdown subset models and READMEs actually use as React nodes, so content can never inject HTML.
 * `document` gives headings real sizes, for READMEs rather than chat answers.
 */
export function Markdown({ text, document }: { text: string; document?: boolean }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.startsWith("```")) {
      const code: string[] = [];
      while (++index < lines.length && !lines[index]!.startsWith("```")) code.push(lines[index]!);
      blocks.push(<pre key={index} className="my-3 overflow-x-auto rounded-xl bg-muted px-4 py-3 font-mono text-[13px] leading-6">{code.join("\n")}</pre>);
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (index < lines.length && LIST_ITEM.test(lines[index]!)) items.push(lines[index++]!.replace(LIST_ITEM, ""));
      index -= 1;
      const List = ordered ? "ol" : "ul";
      // Steps split by blank lines or code blocks keep counting from the number they were written with.
      const start = ordered ? Number(/\d+/.exec(line)![0]) : undefined;
      blocks.push(<List key={index} start={start === 1 ? undefined : start} className={`my-2 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((item, i) => <li key={i}>{inline(item)}</li>)}</List>);
      continue;
    }
    if (TABLE_ROW.test(line)) {
      const rows: string[][] = [];
      while (index < lines.length && TABLE_ROW.test(lines[index]!)) rows.push(cells(lines[index++]!));
      index -= 1;
      blocks.push(<Table key={index} rows={rows.filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell)))} />);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1]!.length, 3) - 1;
      blocks.push(<p key={index} className={document ? HEADING_CLASS[level] : "mt-4 mb-1 font-semibold"}>{inline(heading[2]!)}</p>);
      continue;
    }
    if (line.trim()) {
      blocks.push(<p key={index}>{inline(line)}</p>);
      continue;
    }
    if (blocks.length) blocks.push(<div key={index} className="h-3" />);
  }
  return <>{blocks}</>;
}

function Table({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows;
  if (!head) return null;
  return <div className="my-3 overflow-x-auto rounded-xl border">
    <table className="w-full text-left text-sm">
      <thead className="bg-muted/50"><tr>{head.map((cell, i) => <th key={i} className="px-3 py-2 font-medium">{inline(cell)}</th>)}</tr></thead>
      <tbody className="divide-y">{body.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i} className="px-3 py-2 align-top">{inline(cell)}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function inline(text: string): ReactNode {
  return text.split(/(!?\[[^\]]*\]\([^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`)/).map((part, index) => {
    const link = /^(!?)\[([^\]]*)\]\(([^)\s]+)\)$/.exec(part);
    // shortcut: images are dropped (README-relative paths would not resolve here); render them when packages ship hosted ones.
    if (link?.[1]) return null;
    if (link) return <InlineLink key={index} label={link[2]!} href={link[3]!} />;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">{part.slice(1, -1)}</code>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Only absolute http(s) links become anchors; relative or script URLs stay plain text. */
function InlineLink({ label, href }: { label: string; href: string }) {
  if (!/^https?:\/\//i.test(href)) return <>{label}</>;
  return <a href={href} target="_blank" rel="noreferrer noopener" className="underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground">{label}</a>;
}

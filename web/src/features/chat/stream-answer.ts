import type { ChatAttachmentDto } from "../../shared/types.js";
import type { Step, Turn } from "../conversations/use-conversations.js";

interface StreamEvent { delta?: string; step?: Step; done?: boolean; components?: string[]; error?: string }

/** Starts a turn on the server and follows it. */
export async function streamAnswer(question: string, sessionId: string, turnId: number, patch: (fields: Partial<Turn>) => void, attachments: ChatAttachmentDto[] = []): Promise<void> {
  const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: question, sessionId, turnId: String(turnId), attachments: attachments.map(({ id }) => id) }) });
  return readTurn(response, patch);
}

/** Follows a turn that kept running on the server after the page was closed; it replays from the start. False if the server forgot it. */
export async function resumeAnswer(turnId: number, patch: (fields: Partial<Turn>) => void): Promise<boolean> {
  const response = await fetch(`/api/chat/turn?id=${turnId}`);
  if (response.status === 404) return false;
  await readTurn(response, patch);
  return true;
}

/** Reads the route's newline-delimited JSON stream and reports steps and deltas, then the final components. */
async function readTurn(response: Response, patch: (fields: Partial<Turn>) => void): Promise<void> {
  if (!response.ok || !response.body) throw new Error(`Request failed (${response.status})`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer: string | undefined;
  let steps: Step[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    // A stream that closes without its `done` event must still stop the spinner.
    if (done) return patch({ streaming: false });
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.error) throw new Error(event.error);
      if (event.step) { steps = mergeStep(steps, event.step); patch({ steps }); }
      if (event.delta) { answer = (answer ?? "") + event.delta; patch({ answer }); }
      if (event.done) patch({ answer: answer ?? "", components: event.components ?? [], streaming: false, endedAt: new Date().toISOString() });
    }
  }
}

/** A later step with the same id updates it; a `delta` grows its output. Same rule as the server's store. */
function mergeStep(steps: Step[], step: Step): Step[] {
  const { delta, ...fields } = step;
  const index = steps.findIndex(({ id }) => id === step.id);
  const grown = (item?: Step): Step => delta ? { ...fields, output: (item?.output ?? "") + delta } : fields;
  if (index === -1) return [...steps, grown()];
  return steps.map((item, at) => at === index ? { ...item, ...grown(item) } : item);
}

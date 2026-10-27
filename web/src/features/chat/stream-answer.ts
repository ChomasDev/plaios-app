import type { Turn } from "../conversations/use-conversations.js";

interface StreamEvent { delta?: string; done?: boolean; components?: string[]; error?: string }

/** Reads the route's newline-delimited JSON stream and reports each delta, then the final components. */
export async function streamAnswer(question: string, sessionId: string, patch: (fields: Partial<Turn>) => void): Promise<void> {
  const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: question, sessionId }) });
  if (!response.ok || !response.body) throw new Error(`Request failed (${response.status})`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
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
      if (event.delta) { answer += event.delta; patch({ answer }); }
      if (event.done) patch({ answer, components: event.components ?? [], streaming: false });
    }
  }
}

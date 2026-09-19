import type {
  AIProcessResult,
  AgentLoop,
  InputInterface,
  InputMessage,
  Memory,
  Orchestrator,
  OutputInterface,
} from "@agent-os/core";

import { ConversationHistory } from "./agent-conversation-history.js";
import { addDeliveryContext } from "./agent-delivery-context.js";
import { persistMemoryProposals } from "./agent-memory-proposals.js";

const INPUT_RESTART_DELAY_MS = 1_000;

export interface AgentRuntimeOptions {
  inputs: readonly InputInterface[];
  outputs: readonly OutputInterface[];
  memory: Memory;
  orchestrator: Orchestrator;
  agentLoop: AgentLoop;
  stream?: boolean;
}

export class AgentRuntime {
  private listening = false;
  private running?: Promise<void>;

  constructor(private readonly options: AgentRuntimeOptions) {}

  start(): void {
    if (this.listening) return;
    this.listening = true;
    const history = new ConversationHistory(this.options.memory);
    const listener = (message: InputMessage) => this.handle(message, history);
    this.running = Promise.all(
      this.options.inputs.map((input) => this.superviseInput(input, listener)),
    ).then(() => undefined).finally(() => {
      this.listening = false;
    });
    void this.running.catch((error: unknown) => {
      if (this.listening) console.error("[agent-os] Message runtime stopped:", error);
    });
  }

  async stop(): Promise<void> {
    if (!this.listening && !this.running) return;
    this.listening = false;
    const inputs = uniqueByIdentity(this.options.inputs);
    const results = await Promise.allSettled(inputs.map((input) => input.stop()));
    await this.running?.catch(() => undefined);
    this.running = undefined;
    const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
    if (errors.length) throw new AggregateError(errors, "Failed to stop Agent OS inputs");
  }

  private async handle(message: InputMessage, history: ConversationHistory): Promise<void> {
    const contextualized = await history.contextualize(message);
    await history.rememberUser(contextualized);
    const decision = await this.options.orchestrator.orchestrate(contextualized, this.options.outputs);
    await persistMemoryProposals(this.options.memory, message, decision.memoryProposals);
    const output = this.options.outputs.find(({ channel }) => channel === decision.outputChannel);
    if (!output) throw new Error(`Orchestrator selected unavailable output "${decision.outputChannel}"`);

    const response = await this.options.agentLoop.run(
      addDeliveryContext(contextualized, decision.outputChannel),
      {
        capabilityIds: decision.capabilityIds,
        stream: this.options.stream ?? true,
        bypassModel: decision.bypassModel,
      },
    );
    const additional = (decision.additionalOutputs ?? []).map((route) => {
      const destination = this.options.outputs.find(({ channel }) => channel === route.outputChannel);
      if (!destination) throw new Error(`Orchestrator selected unavailable output "${route.outputChannel}"`);
      return { route, destination };
    });
    const responseOutputs = [
      output,
      ...additional.filter(({ route }) => route.content === "response").map(({ destination }) => destination),
    ];
    const text = await deliverResponse(response, responseOutputs);
    await history.rememberAssistant(message, text);

    if (decision.deferMemoryProposal && this.options.orchestrator.proposeMemory) {
      void this.options.orchestrator.proposeMemory(contextualized)
        .then((proposals) => persistMemoryProposals(this.options.memory, message, proposals))
        .catch((error: unknown) => console.warn("[agent-os] Deferred memory extraction failed:", error));
    }
    for (const { route, destination } of additional) {
      if (route.content === "text" && route.text !== undefined) await destination.write(route.text);
    }
  }

  private async superviseInput(input: InputInterface, listener: (message: InputMessage) => Promise<void>): Promise<void> {
    while (this.listening) {
      try {
        await input.start(listener);
        return;
      } catch (error) {
        if (!this.listening) return;
        console.error(`[agent-os] Input "${input.channel}" failed; restarting in ${INPUT_RESTART_DELAY_MS}ms:`, error);
        await input.stop().catch((stopError: unknown) => console.error(`[agent-os] Input "${input.channel}" cleanup failed:`, stopError));
        await new Promise((resolve) => setTimeout(resolve, INPUT_RESTART_DELAY_MS));
      }
    }
  }
}

async function deliverResponse(response: AIProcessResult, outputs: readonly OutputInterface[]): Promise<string> {
  if (response.type === "text") {
    for (const output of outputs) await output.write(response.text);
    return response.text;
  }
  if (outputs.length > 1) {
    let text = "";
    for await (const chunk of response.stream) text += chunk;
    for (const output of outputs) await output.write(text);
    return text;
  }
  const chunks: string[] = [];
  await outputs[0]!.write(capture(response.stream, chunks));
  return chunks.join("");
}

async function* capture(stream: AsyncIterable<string>, chunks: string[]): AsyncGenerator<string> {
  for await (const chunk of stream) {
    chunks.push(chunk);
    yield chunk;
  }
}

function uniqueByIdentity<T extends object>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

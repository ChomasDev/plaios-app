export type ChatEvent = Record<string, unknown>;
type Listener = (event: ChatEvent) => void;

interface LiveTurn { events: ChatEvent[]; listeners: Set<Listener>; finished: boolean }

const KEEP_FINISHED_MS = 60 * 60_000;

/**
 * Chat turns run detached from the request that started them and keep their event log,
 * so a closed or reloaded page can follow the same turn again from the start.
 * shortcut: in memory only, a host restart forgets live turns; persist them if that matters.
 */
export class ChatTurns {
  private readonly turns = new Map<string, LiveTurn>();

  /** Starts `work` once per id; `emit` must end the turn with a `done` or `error` event. */
  start(id: string, work: (emit: Listener) => Promise<void>): void {
    if (this.turns.has(id)) return;
    const turn: LiveTurn = { events: [], listeners: new Set(), finished: false };
    this.turns.set(id, turn);
    const emit = (event: ChatEvent) => {
      if (turn.finished) return;
      turn.events.push(event);
      if (event.done || event.error) turn.finished = true;
      for (const listener of turn.listeners) listener(event);
      if (turn.finished) {
        turn.listeners.clear();
        setTimeout(() => this.turns.delete(id), KEEP_FINISHED_MS).unref();
      }
    };
    void work(emit).catch((error: unknown) => emit({ error: error instanceof Error ? error.message : String(error) }));
  }

  /** Replays the turn so far, then streams the rest. Returns undefined for an unknown turn, else an unsubscribe. */
  follow(id: string, listener: Listener): (() => void) | undefined {
    const turn = this.turns.get(id);
    if (!turn) return undefined;
    for (const event of turn.events) listener(event);
    if (turn.finished) return () => undefined;
    turn.listeners.add(listener);
    return () => turn.listeners.delete(listener);
  }
}

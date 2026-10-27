import { Renderer, type LibraryActionEvent } from "@openuidev/react-lang";
import { useCallback } from "react";

import type { RuntimeComponentDto } from "../../../shared/types.js";
import { useOpenUILibrary, type Library } from "./use-openui-library.js";

/** Renders a streaming OpenUI Lang answer as live UI; buttons that talk back to the assistant become new questions. */
export function GenerativeAnswer({ text, streaming, components, onAsk }: { text: string; streaming: boolean; components: RuntimeComponentDto[]; onAsk(text: string): void }) {
  const library = useOpenUILibrary(components);
  const response = text.replace(/^\s*```[a-z-]*\s*/, "").replace(/\s*```\s*$/, "");
  const onAction = useCallback((event: LibraryActionEvent<Library>) => {
    if (event.type === "continue_conversation" && event.humanFriendlyMessage) return onAsk(event.humanFriendlyMessage);
    if (event.type === "open_url" && typeof event.params.url === "string") window.open(event.params.url, "_blank", "noopener");
  }, [onAsk]);
  return <div className="openui-answer"><Renderer response={response} library={library} isStreaming={streaming} onAction={onAction} /></div>;
}

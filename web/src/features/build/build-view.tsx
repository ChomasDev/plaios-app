import { useHostSettings } from "../../shared/api.js";
import type { RuntimeComponentDto } from "../../shared/types.js";
import { Page } from "../../shared/ui/page.js";
import { Stage } from "./stage.js";
import { STAGES } from "./stages.js";

export function BuildView({ components }: { components: RuntimeComponentDto[] }) {
  const settings = useHostSettings();
  const slots = settings.data?.slots ?? [];
  return <Page title="Build" intro="Your agent, piece by piece. Add a block from the store, switch one off, or replace a core part.">
    <ol className="relative ml-2 border-l pl-8">
      {STAGES.map((stage, index) => <Stage key={stage.title} stage={stage} index={index} components={components} slots={slots} />)}
    </ol>
  </Page>;
}

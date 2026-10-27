import { motion } from "framer-motion";
import { Plus } from "lucide-react";

import { rise, stagger } from "../../shared/motion.js";
import { CORE_KINDS, TOGGLE_KINDS, type RuntimeComponentDto, type RuntimeSlotDto } from "../../shared/types.js";
import { ComponentBlock } from "./component-block.js";
import { ReplaceSelect } from "./replace-select.js";
import { TILE, type StageSpec } from "./stages.js";

export function Stage({ stage, index, components, slots }: { stage: StageSpec; index: number; components: RuntimeComponentDto[]; slots: RuntimeSlotDto[] }) {
  const blocks = components.filter((item) => stage.kinds.includes(item.kind));
  const coreKinds = stage.kinds.filter((kind) => CORE_KINDS.includes(kind));
  const addable = stage.kinds.some((kind) => TOGGLE_KINDS.includes(kind));
  const replacements = (kind: RuntimeSlotDto["kind"]) => (slots.find((slot) => slot.kind === kind)?.options ?? [])
    .filter((option) => !blocks.some((item) => item.packageName === option.packageName));

  return <motion.li {...rise(stagger(index))} className="relative pb-10 last:pb-0">
    <span aria-hidden="true" className="absolute top-1.5 -left-[2.3rem] size-3 rounded-full border-2 border-background bg-foreground" />
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
      <h2 className="text-base font-medium">{stage.title}</h2>
      <p className="text-xs text-muted-foreground">{stage.hint}</p>
    </div>
    <div className="flex flex-wrap gap-3">
      {blocks.map((item) => <ComponentBlock key={item.instanceId} component={item} />)}
      {coreKinds.map((kind) => <ReplaceSelect key={kind} kind={kind} options={replacements(kind)} />)}
      {addable ? <AddTile kind={stage.kinds[0]!} /> : null}
    </div>
  </motion.li>;
}

function AddTile({ kind }: { kind: string }) {
  return <a href={`#store/${encodeURIComponent(kind)}`} className={`${TILE} group gap-1`}>
    <span className="flex items-center gap-1.5"><Plus className="size-3.5 transition-transform duration-200 group-hover:rotate-90" />Add</span>
  </a>;
}

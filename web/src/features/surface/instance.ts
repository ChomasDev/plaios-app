import type { ComponentInstance } from "@plaios/microfrontend";

import type { RuntimeComponentDto } from "../../shared/types.js";

export function toInstance(component: RuntimeComponentDto): ComponentInstance {
  return { instanceId: component.instanceId, kind: component.kind, id: component.id, packageId: component.packageId, version: component.version, config: component.config, fields: component.configFields as ComponentInstance["fields"] };
}

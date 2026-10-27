import { AnimatePresence, motion } from "framer-motion";

import { EASE_OUT } from "../shared/motion.js";
import type { RuntimeComponentDto } from "../shared/types.js";
import { BuildView } from "../features/build/build-view.js";
import { ComponentPage } from "../features/build/component-page.js";
import { SettingsView } from "../features/settings/settings-view.js";
import { PackagePage } from "../features/store/package-page.js";
import { StoreView } from "../features/store/store-view.js";
import { ManageNav } from "./header.js";
import type { Route } from "./routes.js";

/** The right sheet: Build, a component, Store or Settings, crossfading as the route changes. */
export function ManageView({ route, components }: { route: Route; components: RuntimeComponentDto[] }) {
  return <>
    <ManageNav active={route.view} />
    <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={`${route.view}/${route.selectedId ?? route.packageName ?? ""}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      <ManagePage route={route} components={components} />
    </motion.div>
  </AnimatePresence>
  </>;
}

function ManagePage({ route, components }: { route: Route; components: RuntimeComponentDto[] }) {
  const selected = components.find((item) => item.instanceId === route.selectedId);
  if (selected) return <ComponentPage component={selected} />;
  if (route.packageName) return <PackagePage name={route.packageName} />;
  if (route.view === "store") return <StoreView key={route.query} initialQuery={route.query} />;
  if (route.view === "settings") return <SettingsView />;
  return <BuildView components={components} />;
}

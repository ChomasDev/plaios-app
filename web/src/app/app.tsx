import { motion } from "framer-motion";

import { useRuntime } from "../shared/api.js";
import { EmptyState } from "../shared/ui/empty-state.js";
import { UnpluggedScene } from "../shared/ui/illustrations.js";
import { AppHeader } from "./header.js";
import { useRoute, type Route } from "./routes.js";
import { useTheme } from "./use-theme.js";
import { Workspace } from "./workspace.js";

export function App() {
  const route = useRoute();
  const theme = useTheme();
  const runtime = useRuntime();
  return <div className="relative flex h-svh flex-col overflow-hidden">
    <AppHeader route={route} components={runtime.data?.components} theme={theme} />
    <AppBody route={route} runtime={runtime} />
  </div>;
}

function AppBody({ route, runtime }: { route: Route; runtime: ReturnType<typeof useRuntime> }) {
  if (runtime.data) return <Workspace route={route} components={runtime.data.components} />;
  if (runtime.isError) return <div className="mx-auto w-full max-w-xl p-10"><EmptyState art={<UnpluggedScene />} title="Agent OS is not answering" hint={runtime.error.message} /></div>;
  return <Booting />;
}

function Booting() {
  return <motion.p
    initial={{ opacity: 0 }}
    animate={{ opacity: [0.4, 1, 0.4] }}
    transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, delay: 0.3 }}
    className="p-10 text-center text-sm text-muted-foreground"
  >Starting…</motion.p>;
}

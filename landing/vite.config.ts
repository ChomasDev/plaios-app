import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Two prerendered pages: the landing and /docs/ (the developer guide, shared with the plugin).
export default defineConfig({
  resolve: { dedupe: ["react", "react-dom", "framer-motion", "lucide-react"] },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        docs: fileURLToPath(new URL("./docs/index.html", import.meta.url)),
      },
    },
  },
});

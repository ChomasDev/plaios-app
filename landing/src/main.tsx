import "@fontsource-variable/noto-sans";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import { App } from "./app.js";
import "./styles.css";

const root = document.getElementById("root")!;
const app = <StrictMode><App /></StrictMode>;
// Production pages ship prerendered HTML (see prerender.mjs); dev serves an empty root.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);

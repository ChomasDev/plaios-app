import "@fontsource-variable/noto-sans";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import "./styles.css";
import "../../../developer-guide/web/guide.css";
import { DocsPage } from "./docs-page.js";

const root = document.getElementById("root")!;
const page = <StrictMode><DocsPage /></StrictMode>;
if (root.hasChildNodes()) hydrateRoot(root, page);
else createRoot(root).render(page);

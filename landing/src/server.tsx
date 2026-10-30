import { renderToString } from "react-dom/server";

import { App } from "./app.js";
import { DocsPage } from "./docs-page.js";

export const render = () => renderToString(<App />);
export const renderDocs = () => renderToString(<DocsPage />);

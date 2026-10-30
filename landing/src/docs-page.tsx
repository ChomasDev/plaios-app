import { MotionConfig } from "framer-motion";

import DeveloperGuide from "../../../developer-guide/web/action/index.js";
import { Footer, Nav } from "./app.js";

/** /docs/: the same guide the Developer guide plugin shows inside PLAIOS, from the same markdown. */
export function DocsPage() {
  return <MotionConfig reducedMotion="user">
    <a href="#main" className="skip">Skip to content</a>
    <Nav />
    <main id="main" className="docs wrap">
      <DeveloperGuide {...({} as Parameters<typeof DeveloperGuide>[0])} />
    </main>
    <Footer />
  </MotionConfig>;
}

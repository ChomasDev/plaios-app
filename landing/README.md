# AgentOS landing page

Standalone React/Vite marketing site, separate from the runtime control plane. Uses the existing app-dynamic dependencies; no agent runtime or secrets are needed.

From the workspace root:

```sh
pnpm landing:dev
pnpm landing:build
pnpm landing:preview
```

The production output is `packages/app-dynamic/dist/landing`. Deploy that folder to any static host. Fonts use Google Fonts, with local sans-serif and monospace fallbacks.

The ASCII canvas supports mouse/touch dragging and arrow-key rotation. Automatic rotation pauses during a drag, preserves the chosen orientation on release, respects reduced motion, and includes a pause control. Rendering is suspended offscreen or in background tabs; manual rotation still works while paused. Capability tabs support arrow keys, Home, and End. Setup commands are deliberately explicit about the current registry requirements.

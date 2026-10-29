# PLAIOS landing page

Standalone React/Vite marketing site, separate from the runtime control plane. It reuses the app's tokens (`microfrontend` globals), Noto Sans and springs, and the existing app-dynamic dependencies (React, framer-motion, lucide). No runtime or secrets needed.

From the workspace root:

```sh
pnpm landing:dev       # http://127.0.0.1:5173
pnpm landing:build     # dist/landing, prerendered
pnpm landing:preview
pnpm landing:deploy    # build + upload dist/landing to Vercel (production)
```

`landing:build` makes the client bundle, then an SSR bundle of `src/server.tsx`, and `prerender.mjs` bakes the rendered HTML into `dist/landing/index.html` so crawlers get the full page. Deploy `dist/landing` to any static host; `landing:deploy` uploads it to Vercel (run `npx vercel login` once). Vercel can't build from git here because the deps are `workspace:*`. Once it has a domain, add `<link rel="canonical">`, `og:url`, `og:image` (absolute URLs) and a `robots.txt`/`sitemap.xml`.

Motion respects `prefers-reduced-motion`; the flow section's steps are keyboard-reachable tabs.

// The host always runs Vite in development, so claim OpenUI's auto-mount flag before react-lang loads; otherwise its Inspect widget appears for every user.
(globalThis as Record<symbol, unknown>)[Symbol.for("openui.devtools.autoMount")] = true;

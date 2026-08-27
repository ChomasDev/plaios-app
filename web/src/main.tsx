import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.js";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 2_000, retry: 1 },
  },
});

class BootBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100svh", padding: 32, fontFamily: "ui-monospace, monospace" }}>
        <p style={{ fontSize: 14, fontWeight: 600 }}>Control plane failed to load</p>
        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>{this.state.error.message}</p>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BootBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BootBoundary>
  </StrictMode>,
);

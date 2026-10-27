import { Component, type ErrorInfo, type ReactNode } from "react";

export class SurfaceBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="p-6 text-sm">
      <p className="font-medium">This component failed to load</p>
      <p className="mt-1 text-muted-foreground">{this.state.error.message}</p>
    </div>;
  }
}

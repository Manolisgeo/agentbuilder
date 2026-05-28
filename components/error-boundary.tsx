"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { HudPanel } from "@/components/hud/hud-panel";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="hud-canvas flex h-screen items-center justify-center p-8">
          <HudPanel tier={2} className="max-w-md p-6 text-center">
            <p className="hud-label mb-2">System fault</p>
            <h2 className="text-sm font-medium">Something went wrong</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {this.state.message || "An unexpected error occurred."}
            </p>
            <Button
              variant="outline"
              className="mt-4 border-white/[0.08] hover:border-primary/30 hover:text-primary"
              onClick={() => this.setState({ hasError: false, message: "" })}
            >
              Retry
            </Button>
          </HudPanel>
        </div>
      );
    }

    return this.props.children;
  }
}

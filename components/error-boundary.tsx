"use client";

import { AlertTriangle } from "lucide-react";
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
          <HudPanel
            tier={3}
            glow="ember"
            className="panel-enter max-w-md p-7 text-center"
          >
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <AlertTriangle className="size-5 text-primary" strokeWidth={2} />
            </div>
            <p className="hud-label">System fault</p>
            <h2 className="mt-2 text-base font-medium text-foreground">
              Something went wrong
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {this.state.message || "An unexpected error occurred."}
            </p>
            <Button
              variant="outline"
              className="lift mt-5 border-black/[0.08] hover:border-primary/35 hover:bg-primary/[0.06] hover:text-primary dark:border-white/[0.08]"
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

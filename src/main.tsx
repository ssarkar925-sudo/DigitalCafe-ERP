import React, { Component, ErrorInfo, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[DigitalCafe ERP Runtime Crash]", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-zinc-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h1 className="text-lg font-black text-rose-400 tracking-tight">
                  Sarkar Communication — Runtime Diagnostics
                </h1>
                <p className="text-xs text-zinc-400">
                  An unhandled error occurred while rendering the workspace terminal.
                </p>
              </div>
            </div>

            <div className="bg-black/60 rounded-xl p-4 border border-zinc-800 font-mono text-xs text-rose-300 overflow-x-auto">
              <p className="font-bold">{this.state.error?.name}: {this.state.error?.message}</p>
              {this.state.errorInfo?.componentStack && (
                <pre className="mt-2 text-[10px] text-zinc-500 whitespace-pre-wrap leading-relaxed">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-zinc-500">
                Safe Mode • Auto-Recovery Active
              </span>
              <button
                type="button"
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Reset Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

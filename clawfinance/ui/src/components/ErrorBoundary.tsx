import { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 rounded-xl border border-red-900/50 bg-red-950/20">
          <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h3>
          <p className="text-xs text-gray-400 mb-4 max-w-md text-center">
            {this.state.error?.message ?? "An unexpected error occurred while rendering this section."}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
          >
            <RefreshCw size={12} />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

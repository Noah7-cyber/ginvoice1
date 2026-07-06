import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 text-red-900 rounded-2xl border border-red-100 h-full w-full">
          <AlertTriangle size={48} className="mb-4 text-red-500 opacity-80" />
          <h2 className="text-xl font-bold mb-2">Guide Screen Error</h2>
          <p className="text-sm opacity-80 mb-6 text-center max-w-md">
            The guide screen encountered an error.
          </p>
          
          {this.state.error && (
            <div className="bg-white p-4 rounded-xl w-full text-xs font-mono mb-6 overflow-auto max-h-32 border border-red-100 text-left">
              <span className="font-bold">{this.state.error.name}: </span>
              {this.state.error.message}
            </div>
          )}

          <button 
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm"
          >
            <RefreshCcw size={16} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

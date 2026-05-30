import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Une erreur inattendue est survenue.";
      
      try {
        const parsedError = JSON.parse(this.state.error?.message || "");
        if (parsedError.error && parsedError.operationType) {
          errorMessage = `Erreur Firestore (${parsedError.operationType}) sur ${parsedError.path}: ${parsedError.error}`;
        }
      } catch (e) {
        // Not a JSON error
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-950 p-6 text-center">
          <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 max-w-md">
            <h2 className="text-xl font-bold text-rose-500 mb-4">Oups ! Quelque chose a mal tourné.</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

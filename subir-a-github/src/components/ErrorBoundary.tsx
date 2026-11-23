import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Estado {
  error: boolean;
}

/** Atrapa cualquier error de la interfaz y muestra un mensaje en español. */
export class ErrorBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: false };

  static getDerivedStateFromError(): Estado {
    return { error: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // A propósito no se imprime nada: los errores podrían contener datos de clientes.
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="tarjeta max-w-sm text-center">
          <p className="text-4xl">😕</p>
          <h1 className="mt-2 text-xl font-bold">Algo salió mal</h1>
          <p className="mt-2 text-stone-600 dark:text-stone-400">
            Tus datos están a salvo en el teléfono. Toca el botón para recargar la aplicación.
          </p>
          <button className="btn-primario mt-4 w-full" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}

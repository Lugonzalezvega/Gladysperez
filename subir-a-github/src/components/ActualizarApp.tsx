import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/** Aviso "Hay una versión nueva, toca para actualizar". */
export function ActualizarApp() {
  const {
    needRefresh: [hayNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Revisa si hay versión nueva cada hora.
      if (registro) setInterval(() => void registro.update(), 60 * 60 * 1000);
    },
  });

  if (!hayNueva) return null;
  return (
    <button
      onClick={() => void updateServiceWorker(true)}
      className="fixed inset-x-3 top-3 z-50 print:hidden mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 font-semibold text-amber-950 shadow-lg"
    >
      <RefreshCw className="h-5 w-5" aria-hidden />
      Hay una versión nueva, toca para actualizar
    </button>
  );
}

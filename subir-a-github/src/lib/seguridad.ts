/** Devuelve la URL solo si es https válida; en otro caso null. */
export function urlHttpsSegura(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Abre un enlace externo https en otra pestaña sin dar acceso a esta. */
export function abrirExterno(url: string): void {
  const segura = urlHttpsSegura(url);
  if (!segura) return;
  window.open(segura, '_blank', 'noopener,noreferrer');
}

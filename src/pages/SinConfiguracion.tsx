export function SinConfiguracion() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="tarjeta max-w-md space-y-2">
        <h1 className="text-xl font-bold">Falta conectar Supabase</h1>
        <p className="text-stone-600 dark:text-stone-400">
          Esta copia de la aplicación se publicó sin la dirección del proyecto. Revisa en GitHub que existan los secretos{' '}
          <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> (paso 5 del README) y vuelve a publicar.
        </p>
      </div>
    </div>
  );
}

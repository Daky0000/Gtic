/** Renders ?error= / ?saved= style feedback passed via searchParams. */
export function Flash({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <div className="mt-4 space-y-2">
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {success}
        </p>
      )}
    </div>
  );
}

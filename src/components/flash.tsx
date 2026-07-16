/** Renders ?error= / ?saved= style feedback passed via searchParams. */
export function Flash({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <div className="mt-4 space-y-2">
      {error && (
        <p
          role="alert"
          className="rounded-[11px] border border-[#e3b5ad] bg-[#faece9] px-[14px] py-[10px] text-sm text-[#b23a2e]"
        >
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-[11px] border border-brand-200 bg-[#eaf0ea] px-[14px] py-[10px] text-sm text-forest">
          {success}
        </p>
      )}
    </div>
  );
}

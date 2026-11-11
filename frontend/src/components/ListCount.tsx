/** The honest count both pagers and the list share, straight from the envelope. */
export function ListCount({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="text-xs font-medium text-slate-500 tabular-nums">
      Mostrando {shown} de {total}
    </p>
  );
}

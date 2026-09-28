export function ChartTooltip({ texto }: { texto: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-[260px] -translate-x-1/2 whitespace-normal rounded-lg bg-pc-text px-2.5 py-1.5 text-left text-[11.5px] font-normal leading-snug text-pc-card shadow-lg group-hover:block group-focus-visible:block"
    >
      {texto}
    </span>
  );
}

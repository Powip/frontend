export function advertisingPeriodFromParams(
  params: URLSearchParams,
): { from: string; to: string } | null {
  if (params.getAll("from").length !== 1 || params.getAll("to").length !== 1) return null;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
      ? timestamp
      : Number.NaN;
  };
  const start = parse(from);
  const end = parse(to);
  const days = (end - start) / 86_400_000 + 1;
  return Number.isFinite(days) && days > 0 && days <= 366 ? { from, to } : null;
}

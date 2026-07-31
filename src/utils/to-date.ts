export const toDate = (value: string | null): Date | null =>
  value ? new Date(value) : null;

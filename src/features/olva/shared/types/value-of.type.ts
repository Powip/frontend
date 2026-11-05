/** Union of the values of an `as const` object: `ValueOf<typeof STATUSES>` -> "A" | "B". */
export type ValueOf<T> = T[keyof T];

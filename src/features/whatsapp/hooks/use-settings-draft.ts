import { useEffect, useRef, useState } from "react";

function isEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface SettingsDraft<T> {
  draft: T;
  setDraft: (next: T) => void;
  isDirty: boolean;
  discard: () => void;
}

export function useSettingsDraft<T>(source: T): SettingsDraft<T> {
  const [base, setBase] = useState<T>(source);
  const [draft, setDraftState] = useState<T>(source);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baseRef = useRef(base);
  baseRef.current = base;
  const sourceKey = JSON.stringify(source);

  useEffect(() => {
    const next = JSON.parse(sourceKey) as T;
    if (isEqual(draftRef.current, baseRef.current)) {
      setBase(next);
      setDraftState(next);
    } else {
      setBase(next);
    }
  }, [sourceKey]);

  return {
    draft,
    setDraft: setDraftState,
    isDirty: !isEqual(draft, base),
    discard: () => setDraftState(base),
  };
}

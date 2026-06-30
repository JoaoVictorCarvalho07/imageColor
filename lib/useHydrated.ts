"use client";

import { useEffect, useState } from "react";

/** True somente após a montagem no cliente — evita mismatch de hidratação
 * ao ler estado persistido em localStorage (seleção). */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

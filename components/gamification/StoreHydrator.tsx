"use client";

import { useEffect } from "react";
import { useProgressStore } from "@/store/useProgressStore";

/** Rehydrates the persisted store after mount (skipHydration avoids SSR mismatch). */
export default function StoreHydrator() {
  useEffect(() => {
    void useProgressStore.persist.rehydrate();
  }, []);
  return null;
}

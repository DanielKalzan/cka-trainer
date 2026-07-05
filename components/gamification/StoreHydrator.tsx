"use client";

import { useEffect } from "react";
import { useExamStore } from "@/store/useExamStore";
import { useProgressStore } from "@/store/useProgressStore";

/** Rehydrates the persisted stores after mount (skipHydration avoids SSR mismatch). */
export default function StoreHydrator() {
  useEffect(() => {
    void useProgressStore.persist.rehydrate();
    void useExamStore.persist.rehydrate();
  }, []);
  return null;
}

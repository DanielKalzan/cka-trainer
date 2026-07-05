"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, ChevronsUp, Zap } from "lucide-react";
import { useProgressStore, type FeedbackEvent } from "@/store/useProgressStore";

function Toast({ event }: { event: FeedbackEvent }) {
  const dismissEvent = useProgressStore((s) => s.dismissEvent);

  useEffect(() => {
    const t = setTimeout(() => dismissEvent(event.id), event.type === "xp" ? 2500 : 4000);
    return () => clearTimeout(t);
  }, [event, dismissEvent]);

  const style =
    event.type === "levelup"
      ? "border-accent/60 bg-accent/15 text-accent"
      : event.type === "badge"
        ? "border-warning/60 bg-warning/15 text-warning"
        : "border-term-green/50 bg-term-green/10 text-term-green";
  const Icon = event.type === "levelup" ? ChevronsUp : event.type === "badge" ? Award : Zap;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-sm shadow-lg backdrop-blur ${style}`}
      onClick={() => dismissEvent(event.id)}
    >
      <Icon className="h-4 w-4" />
      {event.text}
    </motion.div>
  );
}

export default function FeedbackToasts() {
  const events = useProgressStore((s) => s.events);
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {events.map((e) => (
          <Toast key={e.id} event={e} />
        ))}
      </AnimatePresence>
    </div>
  );
}

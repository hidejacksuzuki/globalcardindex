"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "open" | "reviewed" | "closed";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "open",     label: "Open" },
  { value: "reviewed", label: "Reviewed" },
  { value: "closed",   label: "Closed" },
];

export function FeedbackStatusSelect({ id, status }: { id: string; status: Status }) {
  const router = useRouter();
  const [current,   setCurrent]   = useState(status);
  const [isPending, startTransition] = useTransition();

  const onChange = (next: Status) => {
    setCurrent(next);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/feedback/${id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        setCurrent(status);
      }
    });
  };

  const colors: Record<Status, string> = {
    open:     "border-amber-300 bg-amber-50 text-amber-700",
    reviewed: "border-blue-300 bg-blue-50 text-blue-700",
    closed:   "border-slate-300 bg-slate-50 text-slate-500",
  };

  return (
    <select
      value={current}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value as Status)}
      className={`border rounded px-2 py-1 text-[11px] font-medium uppercase tracking-wide outline-none transition disabled:opacity-50 ${colors[current]}`}
    >
      {STATUS_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}

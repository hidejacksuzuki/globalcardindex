"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FeedbackDeleteButton({ id, preview }: { id: string; preview: string }) {
  const router = useRouter();
  const [gone,      setGone]      = useState(false);
  const [isPending, startTransition] = useTransition();

  if (gone) return null;

  const onDelete = () => {
    if (!confirm(`このフィードバックを削除しますか？\n「${preview}」\nこの操作は取り消せません。`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/feedback/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setGone(true);
        router.refresh();
      } catch {
        alert("削除に失敗しました。時間をおいて再度お試しください");
      }
    });
  };

  return (
    <button
      onClick={onDelete}
      disabled={isPending}
      className="text-[11px] text-red-400 hover:text-red-600 transition underline underline-offset-2 disabled:opacity-40"
    >
      {isPending ? "削除中…" : "削除"}
    </button>
  );
}

"use client";

export function BookmarkletCode({ code }: { code: string }) {
  return (
    <textarea
      readOnly
      value={code}
      className="w-full h-24 rounded border border-navy/20 bg-navy/[0.02] p-3 font-mono text-[10px] text-navy/70 resize-none"
      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
    />
  );
}

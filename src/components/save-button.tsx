"use client";

import { useState } from "react";
import { BookmarkIcon } from "@/components/icons";

export function SaveButton({ subject }: { subject: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      aria-pressed={saved}
      className="button button--quiet"
      onClick={() => setSaved((value) => !value)}
      type="button"
    >
      <BookmarkIcon filled={saved} /> {saved ? "찜 해제" : "찜"}
      <span className="sr-only">: {subject}</span>
    </button>
  );
}

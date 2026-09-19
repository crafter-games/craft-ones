"use client";

import { useEffect, useState } from "react";
import { ActionNotice } from "./actionNotice";

export function useActionNotice(scope: string) {
  const [message, setMessage] = useState("");
  const [notice] = useState(() => new ActionNotice(setMessage));
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new room, turn, or local revision resets feedback.
  useEffect(() => {
    notice.clear();
    return () => notice.dispose();
  }, [notice, scope]);
  return { message, notice };
}

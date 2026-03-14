"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export const AlertAckButton = ({ alertId }: { alertId: string }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const acknowledge = async () => {
    setBusy(true);
    const response = await fetch(`/api/alerts/${alertId}/ack`, {
      method: "POST"
    });

    if (!response.ok) {
      setBusy(false);
      return;
    }

    startTransition(() => {
      router.refresh();
    });
    setBusy(false);
  };

  return (
    <button className="button button--ghost" disabled={busy} onClick={acknowledge} type="button">
      {busy ? "Procesando..." : "Acusar recibo"}
    </button>
  );
};

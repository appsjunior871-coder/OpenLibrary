"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui";

export function FavoriteButton({
  documentId,
  initial,
  labels,
}: {
  documentId: string;
  initial: boolean;
  labels: { add: string; remove: string };
}) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle() {
    start(async () => {
      const res = fav
        ? await fetch(`/api/me/favorites/${documentId}`, { method: "DELETE" })
        : await fetch("/api/me/favorites", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ documentId }),
          });
      if (res.ok) {
        setFav(!fav);
        router.refresh();
      }
    });
  }

  return (
    <Button type="button" variant="secondary" onClick={toggle} disabled={pending} aria-pressed={fav}>
      <Heart className={fav ? "h-4 w-4 fill-red-500 text-red-500" : "h-4 w-4"} aria-hidden="true" />
      {fav ? labels.remove : labels.add}
    </Button>
  );
}

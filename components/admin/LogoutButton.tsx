"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { clearAdminSession } from "@/lib/actions";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await clearAdminSession();
          router.push("/admin/login");
          router.refresh();
        })
      }
      aria-label="Sair"
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Sair</span>
    </button>
  );
}

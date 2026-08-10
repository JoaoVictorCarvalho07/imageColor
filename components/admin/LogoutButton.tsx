"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { browserPb, ADMIN_COOKIE } from "@/lib/pb/browser";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        browserPb().authStore.clear();
        document.cookie = `${ADMIN_COOKIE}=; path=/; max-age=0`;
        router.push("/admin/login");
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sair</span>
    </button>
  );
}

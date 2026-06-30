import { redirect } from "next/navigation";
import Link from "next/link";
import { Camera, LayoutDashboard, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: photographer } = await supabase
    .from("photographers")
    .select("studio_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <Link href="/admin" className="flex min-w-0 items-center gap-2">
            <Camera className="h-5 w-5 shrink-0 text-accent" />
            <span className="truncate font-display text-lg text-primary">
              {photographer?.studio_name ?? "Painel"}
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Ensaios</span>
            </Link>
            <Link
              href="/admin/ensaios/novo"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo ensaio</span>
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}

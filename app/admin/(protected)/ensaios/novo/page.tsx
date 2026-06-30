import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NewGalleryForm } from "@/components/admin/NewGalleryForm";

export default function NovoEnsaioPage() {
  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mt-3 font-display text-3xl text-primary">Novo ensaio</h1>
      <p className="text-sm text-muted-foreground">
        Crie a galeria e gere o link de acesso. As mídias e preços você ajusta
        depois (importação do Google Drive entra na próxima etapa).
      </p>
      <NewGalleryForm />
    </div>
  );
}

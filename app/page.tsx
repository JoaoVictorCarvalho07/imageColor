import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="label-caps">Isabel Pontes · Fotografia</p>
      <h1 className="mt-5 font-display text-5xl font-light leading-tight text-primary">
        Sua galeria,
        <br />
        <span className="italic text-accent">do seu jeito</span>
      </h1>
      <p className="mt-5 max-w-md text-muted-foreground">
        Plataforma para você visualizar, escolher e adquirir as fotos e vídeos
        do seu ensaio — de forma simples e segura.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/admin"
          className="rounded-md bg-accent px-7 py-3 text-sm uppercase tracking-wide text-accent-foreground transition-colors hover:opacity-90"
        >
          Logar{" "}
        </Link>
        <span className="text-xs text-muted-foreground">
          Para cliente peça o link unico
        </span>
      </div>
    </main> 
  );
}

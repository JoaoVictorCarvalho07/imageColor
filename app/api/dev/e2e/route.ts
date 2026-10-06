import { NextResponse, type NextRequest } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { sessionCookieName } from "@/lib/access";
import { superuserPb } from "@/lib/pb/superuser";
import {
  createGallery,
  setGalleryPassword,
  getGalleryPublicInfo,
  openGallerySession,
  getSessionGallery,
  saveGallerySelection,
  submitGallerySelection,
} from "@/lib/pb/gallery";
import {
  storePhoto,
  storePhotoFromR2Key,
  newObjectId,
  keysFor,
} from "@/lib/mediaPipeline";
import {
  r2Upload,
  r2Download,
  r2DeleteMany,
  r2PresignedPutUrl,
  BUCKET_PUBLIC,
  BUCKET_PRIVATE,
} from "@/lib/r2";
import { WATERMARK_TEXT } from "@/lib/studio";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_IMAGE_DIR = "C:/Users/jvcar/OneDrive/Documentos/teste-imagens";
const PHOTO_COUNT = 4;

interface Step {
  caso: string;
  ok: boolean;
  detalhe: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class Suite {
  readonly steps: Step[] = [];

  async run(caso: string, fn: () => Promise<string>): Promise<boolean> {
    try {
      this.steps.push({ caso, ok: true, detalhe: await fn() });
      return true;
    } catch (err) {
      this.steps.push({
        caso,
        ok: false,
        detalhe: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  get passed() {
    return this.steps.filter((s) => s.ok).length;
  }

  get failed() {
    return this.steps.filter((s) => !s.ok).length;
  }
}

async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    const buf = await r2Download(bucket, key);
    return buf.length > 0;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Indisponível" }, { status: 404 });
  }

  const imageDir =
    req.nextUrl.searchParams.get("dir") ?? DEFAULT_IMAGE_DIR;

  const suite = new Suite();
  const pb = await superuserPb();

  let galleryId = "";
  let accessToken = "";
  let session = "";
  let mediaIds: string[] = [];
  let finalKey = "";
  const senha = "teste1234";

  try {
    await suite.run("admin: cria ensaio", async () => {
      const res = await createGallery({
        title: "[E2E] Ensaio de teste automatizado",
        clientName: "Cliente Teste",
        clientEmail: "cliente@example.com",
        password: senha,
        accessDays: 15,
      });
      assert(!res.error, `createGallery falhou: ${res.error}`);
      assert(res.id && res.token, "createGallery não devolveu id/token");
      galleryId = res.id!;
      accessToken = res.token!;
      return `id=${galleryId} token=${accessToken}`;
    });

    assert(galleryId, "sem galeria, o resto da suíte não roda");

    await suite.run("admin: redefine a senha de acesso", async () => {
      const res = await setGalleryPassword(galleryId, senha);
      assert(!res.error, `setGalleryPassword falhou: ${res.error}`);
      return "senha regravada";
    });

    await suite.run("admin: grava pacotes e preços", async () => {
      const planos = [
        { media_type: "photo", kind: "single", name: "Avulsa", price_cents: 2500 },
        {
          media_type: "photo",
          kind: "package",
          name: "Pacote Prata",
          included_qty: 10,
          price_cents: 50000,
          extra_item_cents: 2000,
        },
        {
          media_type: "photo",
          kind: "full",
          name: "Ensaio completo",
          price_cents: 120000,
        },
      ];
      for (const p of planos) {
        await pb.collection("pricing_plans").create({ gallery: galleryId, ...p });
      }
      const gravados = await pb
        .collection("pricing_plans")
        .getFullList({ filter: pb.filter("gallery = {:g}", { g: galleryId }) });
      assert(gravados.length === 3, `esperado 3 planos, veio ${gravados.length}`);
      return "3 planos (avulso, pacote, completo)";
    });

    await suite.run("admin: sobe fotos com marca d'água", async () => {
      const arquivos = (await readdir(imageDir))
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        .slice(0, PHOTO_COUNT);
      assert(arquivos.length > 0, `nenhuma imagem em ${imageDir}`);

      let position = 0;
      for (const nome of arquivos) {
        const buffer = await readFile(path.join(imageDir, nome));
        const { mediaId } = await storePhoto({
          galleryId,
          buffer,
          contentType: "image/png",
          position: position++,
          watermarkText: WATERMARK_TEXT,
          filename: nome,
        });
        mediaIds.push(mediaId);
      }
      return `${mediaIds.length} foto(s) processada(s)`;
    });

    await suite.run("admin: upload presigned (caminho do navegador)", async () => {
      const arquivos = (await readdir(imageDir)).filter((f) =>
        /\.(png|jpe?g|webp)$/i.test(f),
      );
      assert(arquivos.length > 0, `nenhuma imagem em ${imageDir}`);
      const nome = arquivos[arquivos.length - 1];
      const buffer = await readFile(path.join(imageDir, nome));

      const objectId = newObjectId();
      const { originalKey } = keysFor(galleryId, objectId);
      const uploadUrl = await r2PresignedPutUrl(
        BUCKET_PRIVATE,
        originalKey,
        "image/png",
      );

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(buffer),
      });
      assert(put.ok, `PUT assinado falhou: ${put.status}`);

      const { mediaId } = await storePhotoFromR2Key({
        galleryId,
        objectId,
        originalKey,
        position: mediaIds.length,
        watermarkText: WATERMARK_TEXT,
        filename: nome,
      });
      mediaIds.push(mediaId);

      const rec = await pb
        .collection("media_items")
        .getOne<{ preview_key: string; thumb_key: string }>(mediaId);
      assert(
        await objectExists(BUCKET_PUBLIC, rec.preview_key),
        "preview ausente após upload presigned",
      );
      assert(
        await objectExists(BUCKET_PUBLIC, rec.thumb_key),
        "thumb ausente após upload presigned",
      );
      return `PUT assinado + processamento ok (${(buffer.length / 1024).toFixed(0)} KB)`;
    });

    await suite.run("pipeline: objetos gravados no R2", async () => {
      assert(mediaIds.length > 0, "nenhuma mídia para verificar");
      const rec = await pb.collection("media_items").getOne<{
        preview_key: string;
        thumb_key: string;
        original_key: string;
        width: number;
        height: number;
      }>(mediaIds[0]);

      const [preview, thumb, original] = await Promise.all([
        objectExists(BUCKET_PUBLIC, rec.preview_key),
        objectExists(BUCKET_PUBLIC, rec.thumb_key),
        objectExists(BUCKET_PRIVATE, rec.original_key),
      ]);
      assert(preview, "preview ausente no bucket público");
      assert(thumb, "thumb ausente no bucket público");
      assert(original, "original ausente no bucket privado");
      assert(rec.width > 0 && rec.height > 0, "dimensões não gravadas");
      return `preview+thumb+original ok (${rec.width}x${rec.height})`;
    });

    await suite.run("cliente: info pública antes do login", async () => {
      const info = await getGalleryPublicInfo(accessToken);
      assert(info, "getGalleryPublicInfo devolveu null");
      assert(!info!.expired, "ensaio veio como expirado");
      assert(info!.clientName === "Cliente Teste", "nome da cliente divergente");
      return `"${info!.title}" · estúdio ${info!.studioName}`;
    });

    await suite.run("cliente: senha errada é rejeitada", async () => {
      const s = await openGallerySession(accessToken, "senha-errada");
      assert(s === null, "senha errada abriu sessão");
      return "rejeitada corretamente";
    });

    await suite.run("cliente: senha correta abre sessão", async () => {
      const s = await openGallerySession(accessToken, senha);
      assert(s, "senha correta não abriu sessão");
      session = s!;
      return "sessão criada";
    });

    await suite.run("cliente: carrega galeria com mídias e planos", async () => {
      const g = await getSessionGallery(session);
      assert(g, "getSessionGallery devolveu null");
      assert(
        g!.media.length === mediaIds.length,
        `esperado ${mediaIds.length} mídias, veio ${g!.media.length}`,
      );
      assert(g!.plans.length === 3, `esperado 3 planos, veio ${g!.plans.length}`);
      assert(g!.media[0].previewUrl, "previewUrl não montada");
      assert(g!.media[0].thumbUrl, "thumbUrl não montada");
      return `${g!.media.length} mídias, ${g!.plans.length} planos`;
    });

    await suite.run("cliente: salva seleção parcial", async () => {
      const res = await saveGallerySelection(session, mediaIds.slice(0, 3));
      assert(!res.error, `saveGallerySelection falhou: ${res.error}`);
      const g = await getSessionGallery(session);
      assert(g!.selectionStatus === "open", `status deveria ser open, veio ${g!.selectionStatus}`);
      return "3 fotos, status open";
    });

    await suite.run("cliente: envia seleção", async () => {
      const res = await submitSelectionChecked(session, mediaIds.slice(0, 3));
      return res;
    });

    await suite.run("admin: enxerga a seleção enviada", async () => {
      const sel = await pb
        .collection("selections")
        .getFirstListItem<{ media: string[]; status: string; submitted_at: string }>(
          pb.filter("gallery = {:g}", { g: galleryId }),
        );
      assert(sel.status === "submitted", `status ${sel.status}`);
      assert(sel.media.length === 3, `${sel.media.length} fotos na seleção`);
      assert(sel.submitted_at, "submitted_at vazio");
      return `3 fotos, enviada em ${sel.submitted_at.slice(0, 16)}`;
    });

    await suite.run("admin: modo cota reflete na galeria", async () => {
      await pb.collection("galleries").update(galleryId, {
        selection_mode: "quota",
        selection_limit: 2,
        extra_photo_cents: 2500,
      });
      const g = await getSessionGallery(session);
      assert(g!.selectionMode === "quota", "modo não virou quota");
      assert(g!.selectionLimit === 2, `limite ${g!.selectionLimit}`);
      assert(g!.extraPhotoCents === 2500, `extra ${g!.extraPhotoCents}`);
      return "cota 2 fotos, extra R$ 25,00";
    });

    await suite.run("entrega (edição): publica finais", async () => {
      finalKey = `${galleryId}/final-e2e`;
      await r2Upload(
        BUCKET_PRIVATE,
        finalKey,
        Buffer.from("conteudo-final-de-teste"),
        "application/octet-stream",
      );
      await pb.collection("final_assets").create({
        gallery: galleryId,
        storage_key: finalKey,
        filename: "foto-final.jpg",
      });
      await pb
        .collection("galleries")
        .update(galleryId, { delivered_at: new Date().toISOString() });

      const g = await getSessionGallery(session);
      assert(g!.downloadReady, "downloadReady false após publicar");
      assert(g!.finals!.length === 1, `${g!.finals!.length} finais`);
      assert(g!.finals![0].bucket === "finals", "bucket deveria ser finals");
      return "1 final publicada, downloadReady";
    });

    await suite.run("http: páginas da cliente renderizam autenticadas", async () => {
      const origin = req.nextUrl.origin;
      const cookie = `${sessionCookieName(accessToken)}=${session}`;

      const paginas = [
        { rota: `/g/${accessToken}/galeria`, procura: "[E2E] Ensaio" },
        { rota: `/g/${accessToken}/selecao`, procura: "seleção" },
        { rota: `/g/${accessToken}/entrega`, procura: "" },
      ];

      for (const { rota, procura } of paginas) {
        const res = await fetch(origin + rota, { headers: { cookie } });
        assert(res.ok, `${rota} devolveu ${res.status}`);
        const html = await res.text();
        assert(
          !procura || html.toLowerCase().includes(procura.toLowerCase()),
          `${rota} não contém "${procura}"`,
        );
      }
      return `${paginas.length} páginas 200`;
    });

    await suite.run("http: galeria sem sessão redireciona", async () => {
      const res = await fetch(
        `${req.nextUrl.origin}/g/${accessToken}/galeria`,
        { redirect: "manual" },
      );
      assert(
        res.status === 307 || res.status === 302,
        `esperado redirect, veio ${res.status}`,
      );
      return `redirect ${res.status} para a tela de senha`;
    });

    await suite.run("http: download do zip das finais", async () => {
      const res = await fetch(
        `${req.nextUrl.origin}/g/${accessToken}/finals-zip`,
        { headers: { cookie: `${sessionCookieName(accessToken)}=${session}` } },
      );
      assert(res.ok, `finals-zip devolveu ${res.status}`);
      assert(
        res.headers.get("content-type")?.includes("zip"),
        `content-type ${res.headers.get("content-type")}`,
      );
      const buf = Buffer.from(await res.arrayBuffer());
      assert(buf.subarray(0, 2).toString() === "PK", "não é um zip válido");
      return `zip válido, ${buf.length} bytes`;
    });

    await suite.run("entrega (download direto): originais das selecionadas", async () => {
      await pb
        .collection("galleries")
        .update(galleryId, { delivery_mode: "direct", delivered_at: "" });
      const g = await getSessionGallery(session);
      assert(g!.downloadReady, "downloadReady false no modo direto");
      assert(g!.finals!.length === 3, `${g!.finals!.length} originais (esperado 3)`);
      assert(g!.finals![0].bucket === "originals", "bucket deveria ser originals");
      await pb.collection("galleries").update(galleryId, { delivery_mode: "edit" });
      return "3 originais liberados";
    });

    await suite.run(
      "regressão: excluir foto não apaga a seleção",
      async () => {
        const alvo = mediaIds[0];
        const rec = await pb.collection("media_items").getOne<{
          preview_key: string;
          thumb_key: string;
          original_key: string;
        }>(alvo);

        await pb.collection("media_items").delete(alvo);

        const sel = await pb
          .collection("selections")
          .getFirstListItem<{ media: string[] }>(
            pb.filter("gallery = {:g}", { g: galleryId }),
          );
        assert(sel.media.length === 2, `seleção ficou com ${sel.media.length} (esperado 2)`);
        assert(!sel.media.includes(alvo), "foto excluída continua na seleção");

        mediaIds = mediaIds.filter((id) => id !== alvo);
        await r2DeleteMany(BUCKET_PUBLIC, [rec.preview_key, rec.thumb_key]);
        await r2DeleteMany(BUCKET_PRIVATE, [rec.original_key]);
        return "seleção preservada com 2 fotos";
      },
    );

    await suite.run("regressão: excluir pacote não apaga a seleção", async () => {
      const plano = await pb
        .collection("pricing_plans")
        .getFirstListItem<{ id: string }>(
          pb.filter("gallery = {:g}", { g: galleryId }),
        );
      await pb.collection("selections").getFirstListItem<{ id: string }>(
        pb.filter("gallery = {:g}", { g: galleryId }),
      ).then((sel) =>
        pb.collection("selections").update(sel.id, { contracted_plan: plano.id }),
      );

      await pb.collection("pricing_plans").delete(plano.id);

      const sel = await pb
        .collection("selections")
        .getFirstListItem<{ media: string[]; contracted_plan: string }>(
          pb.filter("gallery = {:g}", { g: galleryId }),
        );
      assert(sel.media.length === 2, "seleção sumiu ao excluir o pacote");
      assert(!sel.contracted_plan, "referência ao pacote não foi limpa");
      return "seleção preservada, referência limpa";
    });

    await suite.run("cliente: sessão inválida é recusada", async () => {
      const g = await getSessionGallery("sessao-que-nao-existe");
      assert(g === null, "sessão forjada carregou a galeria");
      return "recusada corretamente";
    });

    await suite.run("pagamento: checkout", async () => {
      throw new Error("não implementado — nenhum código de Mercado Pago no projeto");
    });
  } catch (err) {
    suite.steps.push({
      caso: "suíte interrompida",
      ok: false,
      detalhe: err instanceof Error ? err.message : String(err),
    });
  }

  const limpeza: string[] = [];
  if (galleryId) {
    try {
      const restantes = await pb.collection("media_items").getFullList<{
        preview_key: string;
        thumb_key: string;
        original_key: string;
      }>({ filter: pb.filter("gallery = {:g}", { g: galleryId }) });

      const publicos = restantes.flatMap((m) =>
        [m.preview_key, m.thumb_key].filter(Boolean),
      );
      const privados = restantes.map((m) => m.original_key).filter(Boolean);
      if (finalKey) privados.push(finalKey);

      await Promise.allSettled([
        r2DeleteMany(BUCKET_PUBLIC, publicos),
        r2DeleteMany(BUCKET_PRIVATE, privados),
      ]);
      await pb.collection("galleries").delete(galleryId);

      const sobrou = await pb
        .collection("media_items")
        .getList(1, 1, { filter: pb.filter("gallery = {:g}", { g: galleryId }) });
      limpeza.push(
        `galeria removida; ${publicos.length + privados.length} objetos apagados do R2; cascata deixou ${sobrou.totalItems} media_items`,
      );
    } catch (err) {
      limpeza.push(
        `FALHOU: ${err instanceof Error ? err.message : String(err)} (galeria ${galleryId})`,
      );
    }
  }

  return NextResponse.json({
    resumo: `${suite.passed} passou / ${suite.failed} falhou`,
    passos: suite.steps,
    limpeza,
  });
}

async function submitSelectionChecked(
  session: string,
  ids: string[],
): Promise<string> {
  const res = await submitGallerySelection(session, ids);
  assert(!res.error, `submitGallerySelection falhou: ${res.error}`);
  const g = await getSessionGallery(session);
  assert(
    g!.selectionStatus === "submitted",
    `status deveria ser submitted, veio ${g!.selectionStatus}`,
  );
  return "status submitted";
}

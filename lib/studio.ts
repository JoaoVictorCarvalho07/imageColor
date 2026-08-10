/**
 * Dados do estúdio. Antes vinham da tabela `photographers`; como a plataforma
 * atende uma fotógrafa só, viraram constante — uma tabela inteira a menos.
 */
export const STUDIO_NAME = process.env.NEXT_PUBLIC_STUDIO_NAME ?? "Isabel Pontes";

/** Texto da marca d'água — antes era `photographers.watermark_text`. */
export const WATERMARK_TEXT =
  process.env.WATERMARK_TEXT ?? STUDIO_NAME.toUpperCase();

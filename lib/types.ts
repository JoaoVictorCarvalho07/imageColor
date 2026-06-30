export type MediaType = "photo" | "video";

export interface MediaItem {
  id: string;
  type: MediaType;
  /** Cor placeholder usada quando ainda não há imagem real processada. */
  color: string;
  /** URL pública do preview com marca d'água (foto grande ou vídeo .mp4). */
  previewUrl?: string;
  /** URL pública da miniatura/poster (leve, para a grade). */
  thumbUrl?: string;
  durationSec?: number;
}

export type PlanKind = "single" | "package" | "full";

/** Como a cliente escolhe: livre (sem limite) ou com cota inclusa + extras. */
export type SelectionMode = "free" | "quota";
export type SelectionStatus = "open" | "submitted" | "paid";

/**
 * Destino das fotos selecionadas:
 * - `edit`: a fotógrafa edita e publica a entrega final (fluxo padrão).
 * - `direct`: a cliente baixa os originais das selecionadas assim que envia.
 */
export type DeliveryMode = "edit" | "direct";

export interface PricingPlan {
  id: string;
  mediaType: MediaType;
  kind: PlanKind;
  name: string;
  /** Quantidade inclusa (pacotes). */
  includedQty?: number;
  priceCents: number;
  /** Preço por item extra além do incluso (pacotes). */
  extraItemCents?: number;
}

export interface Gallery {
  token: string;
  /** Seed apenas — em produção será hash validado no servidor. */
  password: string;
  studioName: string;
  title: string;
  clientName: string;
  /** Data ISO (YYYY-MM-DD) do fim do acesso. */
  expiresAt: string;
  /** Modo de seleção do ensaio. */
  selectionMode: SelectionMode;
  /** Cota de fotos inclusas (quando `quota`). */
  selectionLimit?: number | null;
  /** Preço por foto extra além da cota, em centavos (quando `quota`). */
  extraPhotoCents?: number | null;
  /** Destino das selecionadas: edição (entrega final) ou download direto. */
  deliveryMode: DeliveryMode;
  media: MediaItem[];
  plans: PricingPlan[];
}

/** Galeria sem dados sensíveis — segura para enviar ao cliente. */
export type PublicGallery = Omit<Gallery, "password"> & {
  /** Status da seleção desta sessão (se já enviada). */
  selectionStatus?: SelectionStatus | null;
  /** Quando a entrega foi publicada (null = ainda não entregue). */
  deliveredAt?: string | null;
  /** Se há arquivos prontos para a cliente baixar (edição entregue OU direto enviado). */
  downloadReady?: boolean;
  /** Arquivos para download (assinados no servidor). `bucket` define a origem. */
  finals?: {
    storageKey: string;
    filename: string | null;
    bucket: "finals" | "originals";
  }[];
};

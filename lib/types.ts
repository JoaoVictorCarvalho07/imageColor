export type MediaType = "photo" | "video";

export interface MediaItem {
  id: string;
  type: MediaType;
  color: string;
  previewUrl?: string;
  thumbUrl?: string;
  durationSec?: number;
}

export type PlanKind = "single" | "package" | "full";

export type SelectionMode = "free" | "quota";
export type SelectionStatus = "open" | "submitted" | "paid";

export type DeliveryMode = "edit" | "direct";

export interface PricingPlan {
  id: string;
  mediaType: MediaType;
  kind: PlanKind;
  name: string;
  includedQty?: number;
  priceCents: number;
  extraItemCents?: number;
}

export interface Gallery {
  token: string;
  password: string;
  studioName: string;
  title: string;
  clientName: string;
  expiresAt: string;
  selectionMode: SelectionMode;
  selectionLimit?: number | null;
  extraPhotoCents?: number | null;
  deliveryMode: DeliveryMode;
  media: MediaItem[];
  plans: PricingPlan[];
}

export interface PaymentState {
  status: "none" | "pending" | "paid";
  amountCents: number;
}

export interface SelectionDraft {
  mediaIds: string[];
  photoPlanId: string | null;
  videoPlanId: string | null;
}

export type PublicGallery = Omit<Gallery, "password"> & {
  selection: SelectionDraft;
  payment: PaymentState;
  selectionStatus?: SelectionStatus | null;
  deliveredAt?: string | null;
  downloadReady?: boolean;
};

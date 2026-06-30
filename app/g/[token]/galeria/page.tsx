import { redirect } from "next/navigation";
import { getSessionGallery } from "@/lib/clientGallery";
import { GalleryView } from "@/components/GalleryView";

export default async function GaleriaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const gallery = await getSessionGallery(token);
  if (!gallery) redirect(`/g/${token}`);

  return <GalleryView gallery={gallery} />;
}

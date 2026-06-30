import { redirect } from "next/navigation";
import { getSessionGallery } from "@/lib/clientGallery";
import { SelectionView } from "@/components/SelectionView";

export default async function SelecaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const gallery = await getSessionGallery(token);
  if (!gallery) redirect(`/g/${token}`);

  return <SelectionView gallery={gallery} />;
}

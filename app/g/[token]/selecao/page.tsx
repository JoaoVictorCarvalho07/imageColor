import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionGallery } from "@/lib/clientGallery";
import { sessionCookieName } from "@/lib/access";
import { syncSessionPayments } from "@/lib/pb/orders";
import { SelectionView } from "@/components/SelectionView";

export default async function SelecaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const session = (await cookies()).get(sessionCookieName(token))?.value;
  if (session) {
    await syncSessionPayments(session).catch((err) =>
      console.error("[payment] sync on return failed:", err),
    );
  }

  const gallery = await getSessionGallery(token);
  if (!gallery) redirect(`/g/${token}`);

  return <SelectionView gallery={gallery} />;
}

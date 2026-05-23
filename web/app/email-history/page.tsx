import { redirect } from "next/navigation";

export default function EmailHistoryRedirectPage() {
  redirect("/marketing-campaigns?tab=email-campaigns");
}

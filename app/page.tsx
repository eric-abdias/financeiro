import { redirect } from "next/navigation";
import { padMonth } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function Home() {
  const now = new Date();
  redirect(`/mes/${now.getFullYear()}-${padMonth(now.getMonth() + 1)}`);
}

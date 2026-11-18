import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { AdminConsole } from "@/components/AdminConsole";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <AdminConsole user={{ name: user.name, role: user.role }} />;
}

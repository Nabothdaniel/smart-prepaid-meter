import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { Dashboard } from "@/components/Dashboard";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <Dashboard user={{ name: user.name, role: user.role }} />;
}

import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");
  return <LoginForm demo={process.env.DEMO_LOGINS !== "off"} />;
}

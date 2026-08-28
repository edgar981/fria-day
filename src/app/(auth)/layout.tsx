import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Si ya hay sesión VÁLIDA (validación real, no mera presencia de cookie),
  // saltar login/registro. Con una cookie inválida getCurrentUser devuelve null
  // → se renderiza el login, sin rebote → sin bucle de redirección.
  const user = await getCurrentUser();
  if (user) redirect("/");

  return <div className="app-shell" style={{ display: "flex", flexDirection: "column" }}>{children}</div>;
}

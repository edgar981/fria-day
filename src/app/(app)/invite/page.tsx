import { redirect } from "next/navigation";

// Pasada N: Invitar dejó de tener pantalla propia (pasó a una hoja en el header del
// Leaderboard). Se conserva la ruta como redirect —para links viejos/guardados— que
// abre la hoja directamente (?invite=1).
export default function InvitePage() {
  redirect("/leaderboard?invite=1");
}

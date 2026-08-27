import { logoutAction } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="btn btn-ghost" style={{ width: "100%" }}>
        Cerrar sesión
      </button>
    </form>
  );
}

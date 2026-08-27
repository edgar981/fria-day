import Link from "next/link";
import { NewSessionForm } from "@/components/NewSessionForm";

export const dynamic = "force-dynamic";

export default function NewSessionPage() {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Link href="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem" }}>
          ←
        </Link>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Nueva salida</h1>
      </div>
      <NewSessionForm />
    </div>
  );
}

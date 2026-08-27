import { NewSessionForm } from "@/components/NewSessionForm";
import { BackHeader } from "@/components/BackHeader";

export const dynamic = "force-dynamic";

export default function NewSessionPage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <BackHeader title="Nueva salida" href="/" />
      <NewSessionForm />
    </div>
  );
}

import { RegisterWizard } from "@/components/RegisterWizard";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <RegisterWizard initialCode={code ?? ""} />;
}

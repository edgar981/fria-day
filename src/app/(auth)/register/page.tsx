import { RegisterForm } from "@/components/RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <RegisterForm initialCode={code ?? ""} />;
}

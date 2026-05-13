import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/visao-geral");

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/visao-geral";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  );
}

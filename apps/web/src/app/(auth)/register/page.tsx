import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/server/current-user";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}

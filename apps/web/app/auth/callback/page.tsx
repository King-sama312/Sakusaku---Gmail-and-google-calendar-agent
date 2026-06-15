import { redirect } from "next/navigation";
import { cookies } from "next/headers";

interface Props {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function AuthCallbackPage({ searchParams }: Props) {
  const { token, error } = await searchParams;

  if (error) {
    redirect(`/signup?error=${error}`);
  }

  if (!token) {
    redirect("/signup?error=missing_token");
  }

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/");
}

export const dynamic = "force-dynamic";

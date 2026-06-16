"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSetAuthCookie } from "~/hooks/api/auth";

export function AuthCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuthCookieAsync, isSuccess, error } = useSetAuthCookie();

  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (errorParam) {
      router.replace(`/login?error=${errorParam}`);
      return;
    }

    if (!token) {
      router.replace("/login?error=missing_token");
      return;
    }

    setAuthCookieAsync({ token });
  }, [token, errorParam, setAuthCookieAsync, router]);

  useEffect(() => {
    if (isSuccess) {
      router.replace("/dashboard");
    }
  }, [isSuccess, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">
        {error ? "Authentication failed. Redirecting..." : "Completing sign in..."}
      </p>
    </main>
  );
}

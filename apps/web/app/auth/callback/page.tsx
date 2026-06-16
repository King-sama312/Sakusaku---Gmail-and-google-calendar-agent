import { Suspense } from "react";
import { AuthCallbackHandler } from "./auth-callback-handler";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Completing sign in...</p>
        </main>
      }
    >
      <AuthCallbackHandler />
    </Suspense>
  );
}

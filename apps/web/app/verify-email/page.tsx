"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useVerifyEmail } from "~/hooks/api/auth"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { verifyEmailAsync, isSuccess, isPending, error } = useVerifyEmail()

  const token = searchParams.get("token")
  const userId = searchParams.get("userId")

  useEffect(() => {
    if (token && userId) {
      verifyEmailAsync({ token, userId })
    }
  }, [token, userId, verifyEmailAsync])

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        {isPending && <p className="text-muted-foreground">Verifying your email...</p>}
        {isSuccess && (
          <div>
            <h1 className="text-2xl font-semibold text-green-600">Email verified!</h1>
            <p className="mt-2 text-muted-foreground">
              Your email has been successfully verified.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Go to login
            </button>
          </div>
        )}
        {error && (
          <div>
            <h1 className="text-2xl font-semibold text-destructive">Verification failed</h1>
            <p className="mt-2 text-muted-foreground">
              {error.message || "The link may have expired or is invalid."}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 text-sm text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

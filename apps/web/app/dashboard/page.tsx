"use client"

import { useGetUserInfo, useSendVerificationEmail } from "~/hooks/api/auth"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"

export default function DashboardPage() {
  const { user } = useGetUserInfo()
  const { sendVerificationEmailAsync, isPending } = useSendVerificationEmail()

  return (
    <div className="min-h-screen p-6">
      {user && !user.emailVerified && (
        <Alert className="mb-6">
          <AlertTitle>Verify your email</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            <span>Please verify your email to access all features.</span>
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => sendVerificationEmailAsync({ userId: user.id })}
            >
              {isPending ? "Sending..." : "Resend verification email"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {user && (
        <p className="mt-2 text-muted-foreground">
          Welcome back, {user.fullName}
        </p>
      )}
    </div>
  )
}

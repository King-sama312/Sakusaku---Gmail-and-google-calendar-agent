"use client";

import { useGetUserInfo } from "~/hooks/api/auth";

export default function DashboardPage() {
  const { user } = useGetUserInfo();

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {user && <p className="mt-2 text-muted-foreground">Welcome back, {user.fullName}</p>}
    </div>
  );
}

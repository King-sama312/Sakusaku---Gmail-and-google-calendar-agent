"use client";

import Link from "next/link";
import { useGetUserInfo } from "~/hooks/api/auth";
import { Button } from "~/components/ui/button";

export default function DashboardPage() {
  const { user } = useGetUserInfo();

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {user && <p className="mt-2 text-muted-foreground">Welcome back, {user.fullName}</p>}
      <div className="mt-6 flex gap-3">
        <Link href="/chat">
          <Button>Chat with Sakuchan</Button>
        </Link>
        <Link href="/mail">
          <Button variant="outline">Mail</Button>
        </Link>
        <Link href="/calendar">
          <Button variant="outline">Calendar</Button>
        </Link>
      </div>
    </div>
  );
}

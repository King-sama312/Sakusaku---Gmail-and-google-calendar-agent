"use client";

import { useGetUserInfo } from "~/hooks/api/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user } = useGetUserInfo();
  const router = useRouter();

  useEffect(() => {
    if (user && user.id) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [user,router]);

  return (
    <main className="min-h-screen min-w-screen flex justify-center items-center">
      <div>
        <h1 className="text-3xl">Sakusaku- your email and calendar AI buddy</h1>
      </div>
    </main>
  );
}

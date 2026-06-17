"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { useGetUserInfo } from "~/hooks/api/auth";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat" },
  { href: "/mail", label: "Email" },
  { href: "/calendar", label: "Calendar" },
];

export function AppNavbar() {
  const pathname = usePathname();
  const { user } = useGetUserInfo();

  const isActive = (href: string) => {
    if (href === "/") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 shadow-sm">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Sakusaku
        </Link>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.href}
              variant={isActive(item.href) ? "default" : "ghost"}
              size="sm"
              className={cn(
                "rounded-full px-4 text-sm font-medium",
                !isActive(item.href) && "text-muted-foreground hover:text-foreground",
              )}
              asChild
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {user.fullName || user.email}
          </span>
        ) : null}
      </div>
    </header>
  );
}

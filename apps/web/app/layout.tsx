import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GlobalProviders } from "~/providers/global";
import { AppNavbar } from "~/components/app-navbar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Sakusaku",
  description: "Email and calendar automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} flex h-screen flex-col`}>
        <GlobalProviders>
          <AppNavbar />
          <div className="flex-1 overflow-hidden min-h-0">{children}</div>
        </GlobalProviders>
      </body>
    </html>
  );
}

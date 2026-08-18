import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetML",
  description: "Practice machine-learning problems in an isolated coding environment.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

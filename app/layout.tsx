import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetML · Machine learning adventures",
  description: "Follow an adventure path of hands-on machine-learning coding quests.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

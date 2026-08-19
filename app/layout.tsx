import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetML · Build a handwritten digit reader",
  description: "Learn machine learning by training and testing a handwritten digit reader.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

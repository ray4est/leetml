import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Handwriting Reader Lab",
  description: "Learn machine learning by training and testing a handwriting reader.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

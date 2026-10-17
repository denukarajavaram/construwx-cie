import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conskill",
  description: "Your space for roles, skills, and competencies.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

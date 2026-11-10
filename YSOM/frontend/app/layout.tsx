import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YSOM — Your SIM Online Manager",
  description:
    "Sign in to your YSOM account to manage supported mobile services.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

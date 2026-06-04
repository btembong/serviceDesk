import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import "./globals.css";
import { CustomToaster } from "@/components/ui/custom-toaster";

const exo2 = Exo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-exo2",
});

export const metadata: Metadata = {
  title: "UBFinance ServiceDesk",
  description: "Secure banking support ticketing platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${exo2.variable} font-exo2`}>
        {children}
        <CustomToaster />
      </body>
    </html>
  );
}

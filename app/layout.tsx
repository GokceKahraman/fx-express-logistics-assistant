import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FX Express — Yapay Zeka Asistanı",
  description: "RAG yaklaşımı ve isteğe bağlı AWS Bedrock bağlantısı içeren kargo asistanı demosu.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "FX Express — Yapay Zeka Asistanı",
    description: "RAG yaklaşımı ve isteğe bağlı AWS Bedrock bağlantısı içeren kargo asistanı demosu.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "FX Express Yapay Zeka Asistanı" }],
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FX Express — Yapay Zeka Asistanı",
    description: "Kargo müşteri deneyimi için RAG prototipi; Bedrock bağlantısı isteğe bağlıdır.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}

import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { ApolloProviderWrapper } from "@/components/providers/apollo-provider";
import "./globals.css";

const appSans = Space_Grotesk({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const appMono = Space_Mono({
  variable: "--font-app-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Exam Module",
    template: "Pinequest",
  },
  description: "Exam Module — Pinequest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn">
      <body
        className={`${appSans.variable} ${appMono.variable} antialiased`}
      >
        <ApolloProviderWrapper>{children}</ApolloProviderWrapper>
      </body>
    </html>
  );
}

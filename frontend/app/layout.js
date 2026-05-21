import { Toaster } from "react-hot-toast";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Aether | Realtime Collaborative IDE",
  description: "A premium, collaborative browser IDE featuring remote cursors, sandboxed code execution, and filesystem sync.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased text-slate-200 bg-rail">
        {children}
        <Toaster position="top-right" toastOptions={{ style: { background: "#0c0e14", color: "#e2e8f0", border: "1px solid #1d2130" } }} />
      </body>
    </html>
  );
}

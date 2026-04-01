import "./globals.css";
import Footer from "@/components/Footer";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-slate-950">
        {/* Main page content grows to fill space */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        
        {/* Footer stays at the very bottom */}
        <Footer />
      </body>
    </html>
  );
}
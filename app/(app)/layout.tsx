import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[88px_1fr]">
      <Sidebar />
      <main className="px-4 py-5 pb-[5.5rem] md:px-10 md:py-10 md:pb-10">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

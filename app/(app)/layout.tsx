import { Sidebar } from "@/components/layout/sidebar";

export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-[88px_1fr]">
      <Sidebar />
      <main className="px-10 py-10">{children}</main>
    </div>
  );
}

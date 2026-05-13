import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const canAccessMetas = session?.user?.email === "thiago@muranojoias.com.br";

  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[88px_1fr]">
      <Sidebar canAccessMetas={canAccessMetas} />
      <main className="px-4 py-5 pb-[5.5rem] md:px-10 md:py-10 md:pb-10">
        {children}
      </main>
      <MobileNav canAccessMetas={canAccessMetas} />
    </div>
  );
}

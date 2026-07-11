import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminUser } from "@/features/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminUser())) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-6 sm:py-8">
      <Link href="/logs" className="text-sm text-accent">
        ← Back to app
      </Link>
      {children}
    </div>
  );
}

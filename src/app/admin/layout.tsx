import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { isAdminUser } from "@/features/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) notFound();

  return <div className="mx-auto max-w-2xl px-6 py-8">{children}</div>;
}

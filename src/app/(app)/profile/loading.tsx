import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="flex flex-col gap-4 border-t border-surface-border pt-8">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function LogsLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-5 rounded-xl border border-surface-border bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

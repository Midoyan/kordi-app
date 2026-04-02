import { Skeleton } from "@/components/ui/skeleton";

export default function SectionLoading() {
  return (
    <section className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4">
        <section className="rounded-xl border border-[#e3e3df] bg-white px-5 py-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)] md:px-6">
          <Skeleton className="h-4 w-24 bg-[#ecece8]" />
          <Skeleton className="mt-4 h-9 w-72 bg-[#ecece8]" />
          <Skeleton className="mt-3 h-5 w-full max-w-2xl bg-[#f1f1ed]" />
        </section>

        <section className="rounded-xl border border-[#e3e3df] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40 bg-[#ecece8]" />
              <Skeleton className="h-4 w-80 bg-[#f1f1ed]" />
            </div>
            <Skeleton className="h-9 w-28 bg-[#ecece8]" />
          </div>
          <div className="mt-5 space-y-3">
            <Skeleton className="h-16 w-full bg-[#f1f1ed]" />
            <Skeleton className="h-16 w-full bg-[#f1f1ed]" />
            <Skeleton className="h-16 w-full bg-[#f1f1ed]" />
          </div>
        </section>
      </div>
    </section>
  );
}

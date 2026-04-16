"use client";

import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { type VehicleAvailability } from "@/components/vehicles-page/types";

export function availabilityTone(availability: VehicleAvailability) {
  switch (availability) {
    case "Active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Inactive":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-[#d7d7d2] bg-[#f3f3ef] text-[#6b6b67]";
  }
}

export function buildSheetHref(pathname: string, searchParams: URLSearchParams, open: boolean) {
  const params = new URLSearchParams(searchParams.toString());

  if (open) {
    params.set("sheet", "add-vehicle");
  } else {
    params.delete("sheet");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#e3e3df] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1d1d1b]">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ColumnHeader({
  label,
  canSort,
  onClick,
  className,
}: {
  label: string;
  canSort: boolean;
  onClick?: () => void;
  className?: string;
}) {
  if (!canSort) {
    return (
      <div
        className={cn(
          "px-3 text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase",
          className,
        )}
      >
        {label}
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 px-3 text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase hover:bg-[#f3f3ef] hover:text-[#1d1d1b]",
        className,
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SheetOpenChange = NonNullable<ComponentProps<typeof Sheet>["onOpenChange"]>;
type EditorSheetOpenChangeDetails = Parameters<SheetOpenChange>[1];

type EditorSheetLayoutProps = {
  open: boolean;
  onOpenChange: (open: boolean, eventDetails?: EditorSheetOpenChangeDetails) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  sheetContentProps?: Omit<
    ComponentProps<typeof SheetContent>,
    "side" | "showOverlay" | "showCloseButton" | "children"
  >;
};

export function EditorSheetLayout({
  open,
  onOpenChange,
  title,
  description,
  children,
  headerActions,
  contentClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  sheetContentProps,
}: EditorSheetLayoutProps) {
  const handleOpenChange: SheetOpenChange = (nextOpen, eventDetails) => {
    if (!nextOpen && eventDetails?.reason !== "close-press") {
      return;
    }

    onOpenChange(nextOpen, eventDetails);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      modal={false}
      disablePointerDismissal
    >
      <SheetContent
        side="right"
        showOverlay={false}
        showCloseButton
        {...sheetContentProps}
        className={cn(
          "w-full overflow-hidden border-[#e4e4e1] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(251,251,248,0.97)_52%,rgba(244,244,239,0.98)_100%)] shadow-[0_24px_80px_-32px_rgba(15,23,42,0.38)] sm:max-w-[420px]",
          contentClassName,
          sheetContentProps?.className,
        )}
      >
        <SheetHeader className={cn("border-b border-[#e7e7e4] px-5 py-5", headerClassName)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className={cn("text-[20px] font-semibold tracking-tight text-[#1d1d1b]", titleClassName)}>
                {title}
              </SheetTitle>
              {description ? (
                <SheetDescription className={cn("mt-1 text-[13px] leading-6 text-[#6b6b67]", descriptionClassName)}>
                  {description}
                </SheetDescription>
              ) : null}
            </div>
            {headerActions}
          </div>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

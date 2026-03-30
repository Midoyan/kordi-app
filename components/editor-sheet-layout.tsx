"use client";

import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type EditorSheetLayoutProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  showCloseButton?: boolean;
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
  showCloseButton = true,
}: EditorSheetLayoutProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        showOverlay={false}
        showCloseButton={showCloseButton}
        className={cn(
          "w-full overflow-hidden border-[#e4e4e1] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(251,251,248,0.97)_52%,rgba(244,244,239,0.98)_100%)] shadow-[0_24px_80px_-32px_rgba(15,23,42,0.38)] sm:max-w-[420px]",
          contentClassName,
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

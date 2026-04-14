"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SheetOpenChange = NonNullable<ComponentProps<typeof Sheet>["onOpenChange"]>;
export type EditorSheetOpenChangeDetails = Parameters<SheetOpenChange>[1];

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
  contentWrapperProps?: ComponentProps<"div">;
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
  contentWrapperProps,
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
        className={cn(
          "w-full overflow-hidden border-[#e4e4e1] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(251,251,248,0.97)_52%,rgba(244,244,239,0.98)_100%)] shadow-[0_24px_80px_-32px_rgba(15,23,42,0.38)] data-ending-style:duration-0 data-ending-style:opacity-100 data-[side=right]:data-ending-style:translate-x-0 sm:max-w-[420px]",
          contentClassName,
        )}
      >
        <div
          {...contentWrapperProps}
          className={cn("flex min-h-0 flex-1 flex-col", contentWrapperProps?.className)}
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EditorSheetForm({
  className,
  ...props
}: ComponentProps<"form">) {
  return (
    <form
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

export function EditorSheetBody({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5", className)}
      {...props}
    />
  );
}

export function EditorSheetFooter({
  className,
  ...props
}: ComponentProps<typeof SheetFooter>) {
  return (
    <SheetFooter
      className={cn("border-t border-[#e7e7e4] bg-white/80 px-5 py-4", className)}
      {...props}
    />
  );
}

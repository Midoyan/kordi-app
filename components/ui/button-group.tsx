import { cn } from "@/lib/utils"

function ButtonGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <>
      <style>{`
        [data-slot="button-group"] > button {
          border-radius: 0;
          border-right-width: 0;
        }
        [data-slot="button-group"] > button:first-child {
          border-radius: 0.5rem 0 0 0.5rem;
        }
        [data-slot="button-group"] > button:last-child {
          border-radius: 0 0.5rem 0.5rem 0;
          border-right-width: 1px;
        }
      `}</style>
      <div
        data-slot="button-group"
        className={cn("flex items-center", className)}
      >
        {children}
      </div>
    </>
  )
}

export { ButtonGroup }

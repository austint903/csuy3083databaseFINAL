import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#57068c] text-white",
        urgent: "bg-red-500 text-white",
        high: "bg-orange-500 text-white",
        medium: "bg-amber-400 text-white",
        low: "bg-emerald-500 text-white",
        norush: "bg-blue-500 text-white",
        sold: "bg-zinc-200 text-zinc-600",
        active: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        outline: "border border-current text-zinc-700",
        glass: "bg-white/15 text-white border border-white/20 backdrop-blur-sm",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

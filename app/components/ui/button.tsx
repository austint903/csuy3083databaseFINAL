import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57068c] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#57068c] text-white shadow-sm hover:bg-[#40046a] active:scale-[0.98]",
        outline: "border-2 border-[#57068c] text-[#57068c] bg-transparent hover:bg-[#57068c] hover:text-white active:scale-[0.98]",
        ghost: "hover:bg-zinc-100 text-zinc-700 active:scale-[0.98]",
        destructive: "bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]",
        secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:scale-[0.98]",
        white: "bg-white text-[#57068c] hover:bg-zinc-50 shadow-sm active:scale-[0.98]",
        muted: "border border-zinc-300 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98]",
        glass: "bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 active:scale-[0.98]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-8 text-base",
        xl: "h-13 rounded-xl px-10 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

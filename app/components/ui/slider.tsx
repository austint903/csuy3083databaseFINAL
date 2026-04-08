import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="range"
        className={cn(
          "w-full h-2 bg-zinc-200 rounded-full appearance-none cursor-pointer accent-[#57068c]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Slider.displayName = "Slider"

export { Slider }

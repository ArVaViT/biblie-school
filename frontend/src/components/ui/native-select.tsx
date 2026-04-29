import * as React from "react"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { nativeSelectVariants } from "./nativeSelectVariants"

export type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> &
  VariantProps<typeof nativeSelectVariants>

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, fieldSize, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(nativeSelectVariants({ fieldSize }), className)}
      {...props}
    />
  ),
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }

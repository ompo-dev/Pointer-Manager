"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-200 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "border-secondary/30 bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        neutral:
          "border-border bg-muted text-foreground [a]:hover:bg-muted/80",
        success:
          "border-[hsl(var(--badge-success-border))] bg-[hsl(var(--badge-success-bg))] text-[hsl(var(--badge-success-foreground))]",
        warning:
          "border-[hsl(var(--badge-warning-border))] bg-[hsl(var(--badge-warning-bg))] text-[hsl(var(--badge-warning-foreground))]",
        info:
          "border-[hsl(var(--badge-info-border))] bg-[hsl(var(--badge-info-bg))] text-[hsl(var(--badge-info-foreground))]",
        destructive:
          "border-[hsl(var(--badge-danger-border))] bg-[hsl(var(--badge-danger-bg))] text-[hsl(var(--badge-danger-foreground))] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:opacity-90",
        outline:
          "border-border bg-background text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

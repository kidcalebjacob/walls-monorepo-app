import * as React from "react"

import { cn } from "@/lib/utils"

const CardPartnerHub = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[50px] border bg-card",
      className
    )}
    {...props}
  />
))
CardPartnerHub.displayName = "CardPartnerHub"

const CardHeaderPartnerHub = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeaderPartnerHub.displayName = "CardHeaderPartnerHub"

const CardTitlePartnerHub = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitlePartnerHub.displayName = "CardTitlePartnerHub"

const CardDescriptionPartnerHub = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescriptionPartnerHub.displayName = "CardDescriptionPartnerHub"

const CardContentPartnerHub = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(className)} {...props} />
))
CardContentPartnerHub.displayName = "CardContentPartnerHub"

const CardFooterPartnerHub = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooterPartnerHub.displayName = "CardFooterPartnerHub"

export {
  CardPartnerHub,
  CardHeaderPartnerHub,
  CardFooterPartnerHub,
  CardTitlePartnerHub,
  CardDescriptionPartnerHub,
  CardContentPartnerHub,
}

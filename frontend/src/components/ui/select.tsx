/* shadcn/ui Select (Radix), restyled for Ledger: filled, no borders or shadows,
   rounded, Phosphor icons instead of lucide. */
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react"
import { Select as SelectPrimitive } from "radix-ui"
import * as React from "react"
import { cn } from "@/lib/utils"

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-[inherit] bg-mist px-4 text-left text-sm text-ink outline-none transition-colors hover:bg-fog/70 focus-visible:bg-[#ececec] data-[state=open]:bg-[#ececec] disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-ash *:data-[slot=select-value]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <CaretDown size={13} className="shrink-0 text-ash transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={6}
        className={cn(
          "relative z-[70] max-h-(--radix-select-content-available-height) min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[1.1rem] bg-white p-1 text-ink",
          "data-[state=open]:animate-[select-in_160ms_cubic-bezier(.16,1,.3,1)]",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-ash"><CaretUp size={12} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="max-h-72 p-0.5">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-ash"><CaretDown size={12} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label data-slot="select-label" className={cn("px-3 py-1.5 text-[11px] text-ash", className)} {...props} />
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-[0.8rem] py-2 pl-3 pr-8 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-mist data-[state=checked]:font-medium data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute right-3 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator><Check size={13} weight="bold" /></SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("mx-2 my-1 h-px bg-mist", className)} {...props} />
}

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue }

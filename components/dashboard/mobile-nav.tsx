"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { MenuIcon } from "lucide-react"
import { LayoutDashboardIcon, GridIcon, ShareIcon, PlusIcon } from "lucide-react"

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  const routes = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboardIcon,
      active: pathname === "/dashboard",
    },
    {
      href: "/dashboard/apps",
      label: "Apps",
      icon: GridIcon,
      active: pathname === "/dashboard/apps",
    },
    {
      href: "/dashboard/shared",
      label: "Shared",
      icon: ShareIcon,
      active: pathname === "/dashboard/shared",
    },
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <MenuIcon className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[240px] sm:w-[300px] pr-0">
        <div className="px-2 py-6 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">P</span>
            </div>
            <span className="font-semibold text-lg">Praxis AI</span>
          </div>
          
          <Button 
            variant="default" 
            className="w-full gap-2 justify-start mb-6"
            onClick={() => {
              // No functionality for now
              setOpen(false)
            }}
          >
            <PlusIcon className="h-4 w-4" />
            <span>New App</span>
          </Button>
          
          <div className="flex flex-col space-y-2">
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                  route.active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <route.icon className="h-4 w-4" />
                {route.label}
              </Link>
            ))}
          </div>
          
          <div className="mt-auto text-xs text-muted-foreground pt-4">
            <div>Praxis AI</div>
            <div className="text-xs text-muted-foreground/70">v1.0.0</div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

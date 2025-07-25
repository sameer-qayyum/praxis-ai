"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PlusIcon, LayoutDashboardIcon, GridIcon, ShareIcon, ChevronLeftIcon } from "lucide-react"

export function DashboardSidebar() {
  const pathname = usePathname()
  // Initialize with a default value, will be updated in effect
  const [collapsed, setCollapsed] = React.useState(false)
  
  // Update collapsed state whenever pathname changes
  React.useEffect(() => {
    const isWizardRoute = pathname.includes('/wizard/')
    const isAppRoute = pathname.includes('/app/')
    setCollapsed(isWizardRoute || isAppRoute)
  }, [pathname])

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboardIcon,
      active: pathname === "/dashboard"
    },
    {
      href: "/dashboard/apps",
      label: "Apps",
      icon: GridIcon,
      active: pathname === "/dashboard/apps"
    },
    {
      href: "/dashboard/shared",
      label: "Shared",
      icon: ShareIcon,
      active: pathname === "/dashboard/shared"
    }
  ]

  return (
    <div className={cn(
      "flex flex-col h-full transition-all duration-300",
      collapsed ? "w-[70px]" : "w-[260px]"
    )}>
      <div className="p-4 flex justify-between items-center h-14">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">P</span>
            </div>
            <span className="font-semibold text-lg">Praxis AI</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">P</span>
            </div>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-full size-8",
            collapsed && "mx-auto"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeftIcon className={cn(
            "h-4 w-4 transition-transform",
            collapsed && "rotate-180"
          )} />
        </Button>
      </div>

      <div className="flex flex-col flex-grow overflow-y-auto p-2">
        {!collapsed && (
          <Button
            variant="default"
            className="w-full gap-2 justify-center py-6 mb-6">
            <PlusIcon className="h-8 w-8" />
            <span>New App</span>
          </Button>
        )}
        {collapsed && (
          <Button
            variant="default"
            size="icon"
            className="mx-auto mb-6 py-6 flex items-center justify-center">
            <PlusIcon className="h-8 w-8" />
          </Button>
        )}

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm transition-all",
                item.active 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:bg-muted",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn(
                "h-6 w-6",
                !collapsed && "mr-2"
              )} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
      </div>

      <div className="p-4 mt-auto">
        {!collapsed ? (
          <div className="text-xs text-muted-foreground">
            <span>Praxis AI</span>
            <span className="block text-xs text-muted-foreground/70">v1.0.0</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center">
            <span>v1.0</span>
          </div>
        )}
      </div>
    </div>
  )
}

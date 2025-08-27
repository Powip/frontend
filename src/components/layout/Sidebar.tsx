"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, Search, LayoutDashboard, User, Heart, Settings, Sun, LogOut } from "lucide-react"
import { Button } from "@/src/components/ui/layout/button"
import { Input } from "@/src/components/ui/layout/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/layout/avatar"
import { cn } from "@/lib/utils"

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: User, label: "User", href: "/user" },
    ...Array.from({ length: 10 }, (_, i) => ({
      icon: Heart,
      label: `Item ${i + 1}`,
      href: `/item-${i + 1}`,
    })),
    { icon: Settings, label: "Settings", href: "/settings" },
  ]

  return (
    <div
      className={cn(
        "flex flex-col p-6 h-screen bg-white border-r border-gray-200 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between py-4 ">
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className={`h-8 w-8 ${!isCollapsed ? "hidden" : ""}`}>
          <Menu className="h-4 w-4 text-green" />
        </Button>
        {!isCollapsed && <div className="font-semibold text-lg">Powip</div>}
        {!isCollapsed && (
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="h-8 w-8">
          <Menu className="h-4 w-4 text-green" />
        </Button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        {isCollapsed ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto">
            <Search className="h-4 w-4 text-green" />
          </Button>
        ) : (
          <div className="relative pr-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search..." className="pl-10" />
          </div>
        )}
      </div>

      {/* items */}
      <div className="flex-1 overflow-y-auto py-4 px-2 scrollbar-hover">
        <nav className="flex flex-col gap-6">
          {menuItems.map((item, index) => (
            <Link key={index} href={item.href} passHref>
              <Button
                asChild
                variant="ghost"
                className="flex items-center gap-3 h-10 justify-start w-full"
              >
                <span>
                  <item.icon className="h-6 w-6 flex-shrink-0 text-green" />
                  {!isCollapsed && (
                    <span className="ml-2 text-sm">{item.label}</span>
                  )}
                </span>
              </Button>
            </Link>
          ))}
        </nav>
      </div>


      <div className="space-y-4">
        <div className="flex items-center">
          {isCollapsed ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto">
              <Sun className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Sun className="h-4 w-4" />
                <span className="text-sm">Light Mode</span>
              </div>
              <div className="w-10 h-6 bg-gray-900 rounded-full relative">
                <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 transition-transform" />
              </div>
            </div>
          )}
        </div>

        {/* user*/}
        <div className="flex items-center">
          {isCollapsed ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 mx-auto">
              <LogOut className="h-4 w-4 text-red" />
            </Button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src="https://www.svgrepo.com/show/17068/user.svg"
                    alt="John Doe"
                  />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="ml-3">
                  <div className="text-sm font-medium">John Doe</div>
                  <div className="text-xs text-gray-500">Web Designer</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <LogOut className="h-4 w-4 text-red" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

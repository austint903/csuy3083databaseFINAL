"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { createClient } from "@/utils/supabase/client"
import { ShoppingCart, Tag, LogIn, LogOut, UtensilsCrossed, UserCircle } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { NotificationBell } from "@/components/NotificationBell"

interface HeaderProps {
  user: User | null
  displayName?: string | null
}

export function Header({ user, displayName }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)

  const netId = user?.email?.split("@")[0] ?? null

  // Fetch pending incoming orders for the badge
  useEffect(() => {
    if (!netId) return
    const supabase = createClient()
    async function loadPending() {
      // Get seller's listing IDs then count pending transactions
      const { data: listings } = await supabase
        .from("listing")
        .select("listing_id")
        .eq("seller_net_id", netId)
      if (!listings || listings.length === 0) return
      const ids = listings.map((l: any) => l.listing_id)
      const { data: statuses } = await supabase.from("status").select("status_id").eq("status_name", "Pending").single()
      if (!statuses) return
      const { count } = await supabase
        .from("transaction")
        .select("transaction_id", { count: "exact", head: true })
        .in("listing_id", ids)
        .eq("status_id", (statuses as any).status_id)
      setPendingCount(count ?? 0)
    }
    loadPending()
  }, [netId])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  if (pathname === "/" || pathname === "/login") return null

  const navLinks = [
    { href: "/buy",  label: "Buy Swipes",  icon: ShoppingCart, badge: 0 },
    { href: "/sell", label: "Sell Swipes", icon: Tag,          badge: 0 },
    ...(user ? [{ href: "/profile", label: "Profile", icon: UserCircle, badge: pendingCount }] : []),
  ]

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <span className="hidden text-base font-bold tracking-tight text-foreground sm:block">
            Swipe<span className="text-primary">Market</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href}>
                <button
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">{label}</span>
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </button>
              </Link>
            )
          })}
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-2 shrink-0">
          <ModeToggle />
          {user && <NotificationBell />}
          <AnimatePresence mode="wait">
            {user ? (
              <motion.div
                key="user"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2"
              >
                <Link href="/profile">
                  <div className="hidden cursor-pointer items-center gap-2 rounded-lg bg-secondary px-3 py-1.5 transition-colors hover:bg-secondary/80 sm:flex">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <span className="text-white text-xs font-bold">
                        {(displayName ?? user.email ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-foreground/80">
                      {displayName ?? user.email}
                    </span>
                  </div>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">Sign Out</span>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="guest"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <Link href="/login">
                  <Button size="sm" className="gap-1.5">
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Log In</span>
                  </Button>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  )
}

export default Header

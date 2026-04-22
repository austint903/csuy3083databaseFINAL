"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, MessageCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useNotificationContext } from "@/components/NotificationProvider"

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markOneRead, latestToast, dismissToast, latestChatToast, dismissChatToast } =
    useNotificationContext()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Auto-dismiss notification toast after 5 s
  useEffect(() => {
    if (!latestToast) return
    const t = setTimeout(dismissToast, 5000)
    return () => clearTimeout(t)
  }, [latestToast, dismissToast])

  // Auto-dismiss chat toast after 5 s
  useEffect(() => {
    if (!latestChatToast) return
    const t = setTimeout(dismissChatToast, 5000)
    return () => clearTimeout(t)
  }, [latestChatToast, dismissChatToast])

  // Mark all read when dropdown opens
  useEffect(() => {
    if (open && unreadCount > 0) markAllRead()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Notification toast (swipe_accepted / new_purchase) */}
      <AnimatePresence>
        {latestToast && (
          <motion.div
            key={latestToast.notification_id}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-6 z-[60] w-80 rounded-xl border border-emerald-200 bg-white shadow-xl p-4 dark:bg-zinc-900 dark:border-emerald-500/30"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">
                  {latestToast.type === "new_purchase" ? "New Purchase Request!" : "Swipe Accepted!"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {latestToast.message}
                </p>
              </div>
              <button
                onClick={dismissToast}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <motion.div
              className="mt-3 h-0.5 rounded-full bg-emerald-400"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat message toast */}
      <AnimatePresence>
        {latestChatToast && (
          <motion.div
            key={latestChatToast.notification_id}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-6 z-[60] w-80 rounded-xl border border-violet-200 bg-white shadow-xl p-4 dark:bg-zinc-900 dark:border-violet-500/30"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-500/20">
                <MessageCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">
                  New message from {latestChatToast.sender_first_name}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {latestChatToast.content}
                </p>
              </div>
              <button
                onClick={dismissChatToast}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <motion.div
              className="mt-3 h-0.5 rounded-full bg-violet-400"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-background shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold text-foreground">Notifications</span>
              {notifications.length > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.notification_id}
                    onClick={() => {
                      markOneRead(n.notification_id)
                      setOpen(false)
                      router.push("/profile?tab=purchases")
                    }}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-accent border-b border-border/50 last:border-0 ${
                      !n.is_read ? "bg-emerald-50/60 dark:bg-emerald-500/5" : ""
                    }`}
                  >
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    )}
                    <div className={`flex-1 min-w-0 ${n.is_read ? "pl-5" : ""}`}>
                      <p className="text-xs text-foreground line-clamp-2">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

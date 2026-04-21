"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

export interface AppNotification {
  notification_id: string
  transaction_id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
}

export interface ChatMessageAlert {
  message_id: string
  transaction_id: string
  sender_net_id: string
  content: string
  created_at: string
}

interface NotificationCtx {
  notifications: AppNotification[]
  unreadCount: number
  markAllRead: () => Promise<void>
  markOneRead: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  latestToast: AppNotification | null
  dismissToast: () => void
  latestChatToast: ChatMessageAlert | null
  dismissChatToast: () => void
}

const Ctx = createContext<NotificationCtx | null>(null)

export function NotificationProvider({
  children,
  netId,
}: {
  children: React.ReactNode
  netId: string | null
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [latestToast, setLatestToast] = useState<AppNotification | null>(null)
  const [latestChatToast, setLatestChatToast] = useState<ChatMessageAlert | null>(null)

  // Initial fetch
  useEffect(() => {
    if (!netId) return
    createClient()
      .from("notification")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setNotifications(data as AppNotification[])
      })
  }, [netId])

  // Realtime subscription
  useEffect(() => {
    if (!netId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${netId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification",
          filter: `recipient_net_id=eq.${netId}`,
        },
        (payload) => {
          const n = payload.new as AppNotification
          setNotifications((prev) => [n, ...prev])
          setLatestToast(n)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [netId])

  const markAllRead = useCallback(async () => {
    if (!netId) return
    await createClient()
      .from("notification")
      .update({ is_read: true })
      .eq("recipient_net_id", netId)
      .eq("is_read", false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }, [netId])

  const markOneRead = useCallback(async (id: string) => {
    await createClient()
      .from("notification")
      .update({ is_read: true })
      .eq("notification_id", id)
    setNotifications((prev) =>
      prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
    )
  }, [])

  const clearAll = useCallback(async () => {
    if (!netId) return
    await createClient().from("notification").delete().eq("recipient_net_id", netId)
    setNotifications([])
  }, [netId])

  // Realtime subscription for incoming chat messages
  useEffect(() => {
    if (!netId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`chat-alerts:${netId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message",
          filter: `sender_net_id=neq.${netId}`,
        },
        (payload) => {
          setLatestChatToast(payload.new as ChatMessageAlert)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [netId])

  const dismissToast = useCallback(() => setLatestToast(null), [])
  const dismissChatToast = useCallback(() => setLatestChatToast(null), [])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <Ctx.Provider
      value={{ notifications, unreadCount, markAllRead, markOneRead, clearAll, latestToast, dismissToast, latestChatToast, dismissChatToast }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useNotificationContext() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useNotificationContext must be used inside NotificationProvider")
  return ctx
}

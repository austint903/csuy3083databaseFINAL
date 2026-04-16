"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, Send, X, Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"

interface ChatMessage {
  message_id: string
  transaction_id: string
  sender_net_id: string
  content: string
  created_at: string
}

interface TransactionChatProps {
  transactionId: string
  currentNetId: string
  otherPartyLabel: string
  disabled?: boolean
}

export function TransactionChat({
  transactionId,
  currentNetId,
  otherPartyLabel,
  disabled = false,
}: TransactionChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load history + subscribe when open
  useEffect(() => {
    if (!open) return
    const supabase = createClient()

    supabase
      .from("message")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[])
      })

    const channel = supabase
      .channel(`chat:${transactionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message",
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [open, transactionId])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  async function sendMessage() {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setDraft("")
    await createClient().from("message").insert({
      transaction_id: transactionId,
      sender_net_id: currentNetId,
      content,
    })
    setSending(false)
    // Realtime will append the message via the subscription
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Chat button */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="w-3 h-3" />
        Chat
      </Button>

      {/* Drawer overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-background shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-[#57068c]" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Chat</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {otherPartyLabel}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-12">
                    <MessageCircle className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground/70">
                      {disabled ? "This transaction is closed." : "Send a message to coordinate your meetup."}
                    </p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMe = msg.sender_net_id === currentNetId
                  return (
                    <div
                      key={msg.message_id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                          isMe
                            ? "bg-[#57068c] text-white rounded-br-sm"
                            : "bg-accent text-foreground rounded-bl-sm"
                        }`}
                      >
                        {!isMe && (
                          <p className="text-[10px] font-semibold opacity-70 mb-0.5">
                            {msg.sender_net_id}
                          </p>
                        )}
                        <p className="text-sm break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border px-4 py-3 shrink-0">
                {disabled ? (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    Messaging is disabled for cancelled transactions.
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message… (Enter to send)"
                      rows={1}
                      className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#57068c]/40 min-h-[38px] max-h-24 overflow-y-auto"
                      style={{ height: "38px" }}
                      onInput={(e) => {
                        const t = e.currentTarget
                        t.style.height = "38px"
                        t.style.height = Math.min(t.scrollHeight, 96) + "px"
                      }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!draft.trim() || sending}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#57068c] text-white transition-opacity disabled:opacity-40 hover:opacity-90"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

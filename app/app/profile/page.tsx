"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/utils/supabase/client"
import {
  MapPin, Clock, ShoppingBag, Tag, CheckCircle2, XCircle,
  PackageCheck, User, Loader2, Star, Pencil, Save, X
} from "lucide-react"
import { TransactionChat } from "@/components/TransactionChat"

interface Transaction {
  transaction_id: string
  buyer_id: string
  listing_id: string
  buyer_confirm: boolean
  seller_confirm: boolean
  transaction_time: string
  status: { status_id: string; status_name: string } | null
  listing: {
    price: number
    amount: string
    seller_net_id: string
    location: { location: string } | null
    type: { type: string } | null
  } | null
}

interface SaleTransaction extends Transaction {
  buyer: { first_name: string; last_name: string; net_id: string } | null
}

interface UserProfile {
  net_id: string
  first_name: string
  last_name: string
  phone_number: string
}

interface Comment {
  comment_id: string
  rating: number
  comment: string
  transaction_id: string
}

function statusColor(name: string) {
  switch (name) {
    case "Pending":   return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
    case "Confirmed": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    case "Completed": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    case "Cancelled": return "bg-muted text-muted-foreground border-border"
    default:          return "bg-muted text-muted-foreground border-border"
  }
}

function buyerStatusLabel(name: string) {
  switch (name) {
    case "Pending":   return "Awaiting Seller"
    case "Confirmed": return "Meet-up Confirmed"
    case "Completed": return "Completed"
    case "Cancelled": return "Cancelled"
    default: return name
  }
}

function sellerStatusLabel(name: string) {
  switch (name) {
    case "Pending":   return "New Request"
    case "Confirmed": return "Accepted"
    case "Completed": return "Completed"
    case "Cancelled": return "Declined"
    default: return name
  }
}

async function fetchPurchases(userId: string): Promise<Transaction[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("transaction")
    .select(`
      transaction_id, buyer_id, listing_id, buyer_confirm, seller_confirm, transaction_time,
      status:status_id ( status_id, status_name ),
      listing:listing_id (
        price, amount, seller_net_id,
        location:preferred_location_id ( location ),
        type:type_id ( type )
      )
    `)
    .eq("buyer_id", userId)
    .order("transaction_time", { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Transaction[]
}

async function fetchSales(userId: string): Promise<SaleTransaction[]> {
  const supabase = createClient()
  const { data: myListings } = await supabase
    .from("listing")
    .select("listing_id")
    .eq("seller_net_id", userId)
  if (!myListings || myListings.length === 0) return []
  const listingIds = myListings.map((l: any) => l.listing_id)
  const { data, error } = await supabase
    .from("transaction")
    .select(`
      transaction_id, buyer_id, listing_id, buyer_confirm, seller_confirm, transaction_time,
      status:status_id ( status_id, status_name ),
      listing:listing_id (
        price, amount, seller_net_id,
        location:preferred_location_id ( location ),
        type:type_id ( type )
      ),
      buyer:buyer_id ( net_id, first_name, last_name )
    `)
    .in("listing_id", listingIds)
    .order("transaction_time", { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as SaleTransaction[]
}

async function fetchStatuses() {
  const supabase = createClient()
  const { data } = await supabase.from("status").select("status_id, status_name")
  return data ?? []
}

async function fetchUserProfile(netId: string): Promise<UserProfile | null> {
  const supabase = createClient()
  const { data } = await supabase.from("user").select("net_id, first_name, last_name, phone_number").eq("net_id", netId).single()
  return data as UserProfile | null
}

async function fetchComments(transactionIds: string[]): Promise<Comment[]> {
  if (transactionIds.length === 0) return []
  const supabase = createClient()
  const { data } = await supabase.from("comment").select("*").in("transaction_id", transactionIds)
  return (data ?? []) as Comment[]
}

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.28 } }),
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border text-center gap-3">
      {icon}
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}

function TransactionSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110 cursor-pointer"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [tab, setTab] = useState<"purchases" | "sales">(
    searchParams.get("tab") === "sales" ? "sales" : "purchases"
  )

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone_number: "" })

  // Rating state
  const [ratingTx, setRatingTx] = useState<string | null>(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingComment, setRatingComment] = useState("")

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const netId = data.user?.user_metadata?.net_id ?? data.user?.email?.split("@")[0] ?? null
      setUserId(netId)
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["purchases", userId],
    queryFn: () => fetchPurchases(userId!),
    enabled: !!userId,
  })

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ["sales", userId],
    queryFn: () => fetchSales(userId!),
    enabled: !!userId,
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ["statuses"],
    queryFn: fetchStatuses,
  })

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => fetchUserProfile(userId!),
    enabled: !!userId,
  })

  const purchaseTxIds = purchases.map((p) => p.transaction_id)
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", purchaseTxIds.join(",")],
    queryFn: () => fetchComments(purchaseTxIds),
    enabled: purchaseTxIds.length > 0,
  })

  // Sync form when profile loads
  useEffect(() => {
    if (userProfile) {
      setProfileForm({
        first_name: userProfile.first_name ?? "",
        last_name: userProfile.last_name ?? "",
        phone_number: userProfile.phone_number ?? "",
      })
    }
  }, [userProfile])

  const statusId = (name: string) => (statuses as any[]).find((s) => s.status_name === name)?.status_id

  const updateStatusMutation = useMutation({
    mutationFn: async ({ transactionId, newStatus }: { transactionId: string; newStatus: string }) => {
      const supabase = createClient()
      const sid = statusId(newStatus)
      if (!sid) throw new Error("Unknown status")
      const updates: any = { status_id: sid }
      if (newStatus === "Confirmed") updates.seller_confirm = true
      if (newStatus === "Completed") updates.seller_confirm = true
      const { error } = await supabase.from("transaction").update(updates).eq("transaction_id", transactionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", userId] })
      queryClient.invalidateQueries({ queryKey: ["purchases", userId] })
      queryClient.invalidateQueries({ queryKey: ["pending-ids", userId] })
    },
  })

  const confirmReceiptMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("transaction")
        .update({ buyer_confirm: true })
        .eq("transaction_id", transactionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases", userId] })
    },
  })

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("user")
        .update({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone_number: profileForm.phone_number,
        })
        .eq("net_id", userId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", userId] })
      setEditingProfile(false)
    },
  })

  const submitRatingMutation = useMutation({
    mutationFn: async ({ transactionId, rating, comment }: { transactionId: string; rating: number; comment: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from("comment").insert({
        transaction_id: transactionId,
        rating,
        comment,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", purchaseTxIds.join(",")] })
      setRatingTx(null)
      setRatingValue(0)
      setRatingComment("")
    },
  })

  const commentByTxId = new Map(comments.map((c) => [c.transaction_id, c]))
  const displayName = userProfile
    ? [userProfile.first_name, userProfile.last_name].filter(Boolean).join(" ") || userEmail || userId
    : userEmail || userId

  return (
    <div className="min-h-screen bg-background">
      {/* Profile header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-brand flex items-center justify-center text-white font-bold text-base shrink-0">
                {(userProfile?.first_name?.[0] ?? userEmail?.[0] ?? "?").toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-tight">
                  {displayName}
                </h1>
                <p className="text-sm text-muted-foreground">{userEmail ?? "Not logged in"}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditingProfile(!editingProfile)}
            >
              {editingProfile ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              {editingProfile ? "Cancel" : "Edit Profile"}
            </Button>
          </div>

          {/* Inline profile editor */}
          <AnimatePresence>
            {editingProfile && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Update your profile</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">First Name</label>
                      <Input
                        placeholder="First name"
                        value={profileForm.first_name}
                        onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Last Name</label>
                      <Input
                        placeholder="Last name"
                        value={profileForm.last_name}
                        onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone Number</label>
                      <Input
                        placeholder="e.g. (123) 456-7890"
                        value={profileForm.phone_number}
                        onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => saveProfileMutation.mutate()}
                      disabled={saveProfileMutation.isPending}
                    >
                      {saveProfileMutation.isPending ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                      ) : (
                        <><Save className="w-3.5 h-3.5" />Save Changes</>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs */}
          <div className="flex mt-6 border-b border-border gap-0.5">
            {([
              { key: "purchases", label: "My Purchases", icon: ShoppingBag, count: purchases.length },
              { key: "sales",     label: "My Sales",     icon: Tag,         count: sales.length },
            ] as const).map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all cursor-pointer ${
                  tab === key
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold transition-colors ${
                  tab === key ? "bg-brand text-white" : "bg-muted text-muted-foreground"
                }`}>{count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* PURCHASES TAB */}
        {tab === "purchases" && (
          <div>
            <p className="text-xs text-muted-foreground mb-5">Swipes you've requested to buy</p>
            {loadingPurchases ? <TransactionSkeleton /> : purchases.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="w-8 h-8 text-muted-foreground/50" />}
                message="You haven't bought any swipes yet. Browse listings to get started."
              />
            ) : (
              <div className="space-y-3">
                {purchases.map((tx, i) => {
                  const statusName = tx.status?.status_name ?? "Unknown"
                  const existingComment = commentByTxId.get(tx.transaction_id)
                  const isRating = ratingTx === tx.transaction_id
                  return (
                    <motion.div key={tx.transaction_id} custom={i} variants={rowVariants} initial="hidden" animate="show">
                      <Card className="border-border bg-card overflow-hidden hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 transition-shadow">
                        <div className={`h-0.5 ${
                          statusName === "Completed" ? "bg-emerald-500" :
                          statusName === "Confirmed" ? "bg-blue-500" :
                          statusName === "Pending"   ? "bg-amber-400" : "bg-border"
                        }`} />
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xl font-bold text-brand">
                                  ${tx.listing?.price.toFixed(2)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  × {tx.listing?.amount} swipe{Number(tx.listing?.amount) !== 1 ? "s" : ""}
                                </span>
                                {tx.listing?.type && (
                                  <span className="text-xs bg-muted text-muted-foreground rounded-md px-2 py-0.5">
                                    {tx.listing.type.type}
                                  </span>
                                )}
                              </div>
                              {tx.listing?.location && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3 text-brand" />
                                  {tx.listing.location.location}
                                </div>
                              )}
                              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Seller: <span className="font-medium text-foreground/80 ml-0.5">{tx.listing?.seller_net_id}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(tx.transaction_time).toLocaleDateString()}
                                </div>
                              </div>

                              {/* Rating display or form */}
                              {statusName === "Completed" && (
                                <div className="mt-1">
                                  {existingComment ? (
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="flex gap-0.5">
                                        {[1,2,3,4,5].map((s) => (
                                          <Star key={s} className={`w-3.5 h-3.5 ${s <= existingComment.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                                        ))}
                                      </div>
                                      <span className="text-xs text-muted-foreground">{existingComment.comment}</span>
                                    </div>
                                  ) : isRating ? (
                                    <div className="mt-2 space-y-2">
                                      <StarRating value={ratingValue} onChange={setRatingValue} />
                                      <Input
                                        placeholder="Leave a comment (optional)"
                                        value={ratingComment}
                                        onChange={(e) => setRatingComment(e.target.value)}
                                        className="text-xs h-8"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs gap-1"
                                          disabled={ratingValue === 0 || submitRatingMutation.isPending}
                                          onClick={() => submitRatingMutation.mutate({
                                            transactionId: tx.transaction_id,
                                            rating: ratingValue,
                                            comment: ratingComment,
                                          })}
                                        >
                                          {submitRatingMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                                          Submit
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs"
                                          onClick={() => { setRatingTx(null); setRatingValue(0); setRatingComment("") }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground mt-1 -ml-1"
                                      onClick={() => { setRatingTx(tx.transaction_id); setRatingValue(0); setRatingComment("") }}
                                    >
                                      <Star className="w-3 h-3" />
                                      Rate this transaction
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${statusColor(statusName)}`}>
                                {buyerStatusLabel(statusName)}
                              </span>
                              {statusName === "Confirmed" && !tx.buyer_confirm && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 gap-1"
                                  onClick={() => confirmReceiptMutation.mutate(tx.transaction_id)}
                                  disabled={confirmReceiptMutation.isPending}
                                >
                                  {confirmReceiptMutation.isPending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  Confirm Receipt
                                </Button>
                              )}
                              {statusName === "Confirmed" && tx.buyer_confirm && (
                                <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> You confirmed
                                </span>
                              )}
                              {userId && (
                                <TransactionChat
                                  transactionId={tx.transaction_id}
                                  currentNetId={userId}
                                  otherPartyLabel={`${tx.listing?.seller_net_id ?? "seller"}`}
                                  disabled={statusName === "Cancelled"}
                                />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* SALES TAB */}
        {tab === "sales" && (
          <div>
            <p className="text-xs text-muted-foreground mb-5">Buy requests for your listings</p>
            {loadingSales ? <TransactionSkeleton /> : sales.length === 0 ? (
              <EmptyState
                icon={<PackageCheck className="w-8 h-8 text-muted-foreground/50" />}
                message="No buy requests yet. Post a listing to start selling."
              />
            ) : (
              <div className="space-y-3">
                {sales.map((tx, i) => {
                  const statusName = tx.status?.status_name ?? "Unknown"
                  const isPending = statusName === "Pending"
                  const isConfirmed = statusName === "Confirmed"
                  const isUpdating = updateStatusMutation.isPending &&
                    (updateStatusMutation.variables as any)?.transactionId === tx.transaction_id
                  return (
                    <motion.div key={tx.transaction_id} custom={i} variants={rowVariants} initial="hidden" animate="show">
                      <Card className="border-border bg-card overflow-hidden hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 transition-shadow">
                        <div className={`h-0.5 ${
                          statusName === "Completed" ? "bg-emerald-500" :
                          statusName === "Confirmed" ? "bg-blue-500" :
                          statusName === "Pending"   ? "bg-amber-400" : "bg-border"
                        }`} />
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xl font-bold text-brand">
                                  ${tx.listing?.price.toFixed(2)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  × {tx.listing?.amount} swipe{Number(tx.listing?.amount) !== 1 ? "s" : ""}
                                </span>
                                {tx.listing?.type && (
                                  <span className="text-xs bg-muted text-muted-foreground rounded-md px-2 py-0.5">
                                    {tx.listing.type.type}
                                  </span>
                                )}
                              </div>
                              {tx.listing?.location && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="w-3 h-3 text-brand" />
                                  {tx.listing.location.location}
                                </div>
                              )}
                              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Buyer: <span className="font-medium text-foreground/80 ml-0.5">
                                    {tx.buyer
                                      ? `${[tx.buyer.first_name, tx.buyer.last_name].filter(Boolean).join(" ") || tx.buyer.net_id}`
                                      : tx.buyer_id}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(tx.transaction_time).toLocaleDateString()}
                                </div>
                              </div>
                              {tx.buyer_confirm && (
                                <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Buyer confirmed receipt
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${statusColor(statusName)}`}>
                                {sellerStatusLabel(statusName)}
                              </span>
                              {isPending && (
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="success"
                                    className="h-7 gap-1 text-xs"
                                    onClick={() => updateStatusMutation.mutate({ transactionId: tx.transaction_id, newStatus: "Confirmed" })}
                                    disabled={isUpdating}
                                  >
                                    {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                                    onClick={() => updateStatusMutation.mutate({ transactionId: tx.transaction_id, newStatus: "Cancelled" })}
                                    disabled={isUpdating}
                                  >
                                    <XCircle className="w-3 h-3" />
                                    Decline
                                  </Button>
                                </div>
                              )}
                              {isConfirmed && (
                                <Button
                                  size="sm"
                                  className="text-xs h-7 gap-1"
                                  onClick={() => updateStatusMutation.mutate({ transactionId: tx.transaction_id, newStatus: "Completed" })}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />}
                                  Mark Complete
                                </Button>
                              )}
                              {userId && (
                                <TransactionChat
                                  transactionId={tx.transaction_id}
                                  currentNetId={userId}
                                  otherPartyLabel={
                                    tx.buyer
                                      ? `${[tx.buyer.first_name, tx.buyer.last_name].filter(Boolean).join(" ") || tx.buyer.net_id}`
                                      : tx.buyer_id
                                  }
                                  disabled={statusName === "Cancelled"}
                                />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

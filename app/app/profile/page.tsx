"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, type Variants } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/utils/supabase/client"
import {
  MapPin, Clock, ShoppingBag, Tag, CheckCircle2, XCircle,
  PackageCheck, User, ChevronRight, Loader2
} from "lucide-react"

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

function statusColor(name: string) {
  switch (name) {
    case "Pending":   return "bg-amber-50 text-amber-700 border-amber-200"
    case "Confirmed": return "bg-blue-50 text-blue-700 border-blue-200"
    case "Completed": return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "Cancelled": return "bg-zinc-100 text-zinc-500 border-zinc-200"
    default:          return "bg-zinc-100 text-zinc-500 border-zinc-200"
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
  // Get listing IDs for this seller
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

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3 } }),
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-zinc-300 text-center gap-3">
      {icon}
      <p className="text-zinc-500 text-sm">{message}</p>
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

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [tab, setTab] = useState<"purchases" | "sales">(
    searchParams.get("tab") === "sales" ? "sales" : "purchases"
  )

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

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#57068c] flex items-center justify-center text-white font-black text-lg">
              {userEmail?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-900">My Profile</h1>
              <p className="text-zinc-500 text-sm">{userEmail ?? "Not logged in"}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mt-6 border-b border-zinc-100 gap-1">
            {([
              { key: "purchases", label: "My Purchases", icon: ShoppingBag, count: purchases.length },
              { key: "sales",     label: "My Sales",     icon: Tag,         count: sales.length },
            ] as const).map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                  tab === key
                    ? "border-[#57068c] text-[#57068c]"
                    : "border-transparent text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                  tab === key ? "bg-[#57068c] text-white" : "bg-zinc-100 text-zinc-500"
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
            <p className="text-xs text-zinc-400 mb-4">Swipes you've requested to buy</p>
            {loadingPurchases ? <TransactionSkeleton /> : purchases.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="w-8 h-8 text-zinc-300" />}
                message="You haven't bought any swipes yet. Browse listings to get started."
              />
            ) : (
              <div className="space-y-3">
                {purchases.map((tx, i) => {
                  const statusName = tx.status?.status_name ?? "Unknown"
                  return (
                    <motion.div key={tx.transaction_id} custom={i} variants={rowVariants} initial="hidden" animate="show">
                      <Card className="border-zinc-200 overflow-hidden hover:shadow-md transition-shadow">
                        <div className={`h-1 ${
                          statusName === "Completed" ? "bg-emerald-400" :
                          statusName === "Confirmed" ? "bg-blue-400" :
                          statusName === "Pending"   ? "bg-amber-400" : "bg-zinc-300"
                        }`} />
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xl font-black text-[#57068c]">
                                  ${tx.listing?.price.toFixed(2)}
                                </span>
                                <span className="text-sm text-zinc-500">
                                  × {tx.listing?.amount} swipe{Number(tx.listing?.amount) !== 1 ? "s" : ""}
                                </span>
                                {tx.listing?.type && (
                                  <span className="text-xs bg-zinc-100 text-zinc-600 rounded-md px-2 py-0.5">
                                    {tx.listing.type.type}
                                  </span>
                                )}
                              </div>
                              {tx.listing?.location && (
                                <div className="flex items-center gap-1 text-xs text-zinc-500">
                                  <MapPin className="w-3 h-3 text-[#57068c]" />
                                  {tx.listing.location.location}
                                </div>
                              )}
                              <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Seller: <span className="font-medium text-zinc-600">{tx.listing?.seller_net_id}@nyu.edu</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(tx.transaction_time).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-xs font-semibold border rounded-full px-2.5 py-1 ${statusColor(statusName)}`}>
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
                                <span className="text-[10px] text-emerald-600 font-medium">You confirmed ✓</span>
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
            <p className="text-xs text-zinc-400 mb-4">Buy requests for your listings</p>
            {loadingSales ? <TransactionSkeleton /> : sales.length === 0 ? (
              <EmptyState
                icon={<PackageCheck className="w-8 h-8 text-zinc-300" />}
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
                      <Card className="border-zinc-200 overflow-hidden hover:shadow-md transition-shadow">
                        <div className={`h-1 ${
                          statusName === "Completed" ? "bg-emerald-400" :
                          statusName === "Confirmed" ? "bg-blue-400" :
                          statusName === "Pending"   ? "bg-amber-400" : "bg-zinc-300"
                        }`} />
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xl font-black text-[#57068c]">
                                  ${tx.listing?.price.toFixed(2)}
                                </span>
                                <span className="text-sm text-zinc-500">
                                  × {tx.listing?.amount} swipe{Number(tx.listing?.amount) !== 1 ? "s" : ""}
                                </span>
                                {tx.listing?.type && (
                                  <span className="text-xs bg-zinc-100 text-zinc-600 rounded-md px-2 py-0.5">
                                    {tx.listing.type.type}
                                  </span>
                                )}
                              </div>
                              {tx.listing?.location && (
                                <div className="flex items-center gap-1 text-xs text-zinc-500">
                                  <MapPin className="w-3 h-3 text-[#57068c]" />
                                  {tx.listing.location.location}
                                </div>
                              )}
                              <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  Buyer: <span className="font-medium text-zinc-600">
                                    {tx.buyer
                                      ? `${tx.buyer.first_name} ${tx.buyer.last_name} (${tx.buyer.net_id}@nyu.edu)`
                                      : `${tx.buyer_id}@nyu.edu`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(tx.transaction_time).toLocaleDateString()}
                                </div>
                              </div>
                              {tx.buyer_confirm && (
                                <span className="text-[10px] text-emerald-600 font-medium">Buyer confirmed receipt ✓</span>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`text-xs font-semibold border rounded-full px-2.5 py-1 ${statusColor(statusName)}`}>
                                {sellerStatusLabel(statusName)}
                              </span>
                              {/* Seller actions */}
                              {isPending && (
                                <div className="flex gap-1.5">
                                  <Button
                                    size="sm"
                                    className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => updateStatusMutation.mutate({ transactionId: tx.transaction_id, newStatus: "Confirmed" })}
                                    disabled={isUpdating}
                                  >
                                    {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 gap-1 text-red-500 border-red-200 hover:bg-red-50"
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

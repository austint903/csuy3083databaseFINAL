"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import {
  MapPin, Clock, Tag, X, UtensilsCrossed, TrendingDown, Filter,
  ShoppingCart, CheckCircle2, Loader2, AlertCircle
} from "lucide-react"

interface Listing {
  listing_id: string
  price: number
  amount: string
  is_active: boolean
  posted_date: string
  expiration_date: string
  seller_net_id: string
  location: { location: string } | null
  urgency: { urgency: string } | null
  discount: { discount_rate: number } | null
  type: { type: string; semester_valid: string } | null
}

type SortOption = "price_asc" | "price_desc" | "amount_asc" | "amount_desc" | "newest"

// All-you-care-to-eat buffet halls (one swipe = unlimited food)
const BUFFET_HALLS = new Set([
  "Third North Dining Hall",
  "Downstein (Weinstein Hall)",
  "Lipton Dining Hall",
  "Palladium Dining Hall",
])

function urgencyBadgeVariant(urgency: string): "urgent" | "high" | "medium" | "low" | "norush" | "default" {
  const map: Record<string, "urgent" | "high" | "medium" | "low" | "norush"> = {
    Urgent: "urgent", High: "high", Medium: "medium", Low: "low", "No Rush": "norush",
  }
  return map[urgency] ?? "default"
}

async function fetchListings(): Promise<Listing[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("listing")
    .select(`
      listing_id, price, amount, is_active, posted_date, expiration_date, seller_net_id,
      location:preferred_location_id ( location ),
      urgency:urgency_id ( urgency ),
      discount:discount_id ( discount_rate ),
      type:type_id ( type, semester_valid )
    `)
    .eq("is_active", true)
    .order("posted_date", { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Listing[]
}

async function fetchMyPendingListingIds(userId: string): Promise<Set<string>> {
  const supabase = createClient()
  const { data } = await supabase
    .from("transaction")
    .select("listing_id, status:status_id(status_name)")
    .eq("buyer_id", userId)
  const ids = new Set<string>()
  ;(data ?? []).forEach((t: any) => {
    if (t.status?.status_name !== "Cancelled" && t.status?.status_name !== "Completed") {
      ids.add(t.listing_id)
    }
  })
  return ids
}

function ListingCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-8 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function BuyPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [priceMax, setPriceMax] = useState(20)
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [showFilters, setShowFilters] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [buyingListing, setBuyingListing] = useState<Listing | null>(null)
  const [buyError, setBuyError] = useState("")
  const [justBought, setJustBought] = useState<Set<string>>(new Set())

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const netId = data.user?.user_metadata?.net_id ?? data.user?.email?.split("@")[0] ?? null
      setUserId(netId)
    })
  }, [])

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchListings,
    refetchOnMount: "always",
  })

  const { data: pendingIds = new Set<string>() } = useQuery({
    queryKey: ["pending-ids", userId],
    queryFn: () => fetchMyPendingListingIds(userId!),
    enabled: !!userId,
  })

  const buyMutation = useMutation({
    mutationFn: async (listing: Listing) => {
      setBuyError("")
      const supabase = createClient()

      // ensure user row exists
      const { error: userErr } = await supabase.rpc("ensure_current_user_row")
      if (userErr) throw new Error(`Profile error: ${userErr.message}`)

      // fetch pending status id
      const { data: statuses } = await supabase.from("status").select("status_id, status_name")
      const pendingStatus = (statuses ?? []).find((s: any) => s.status_name === "Pending")
      if (!pendingStatus) throw new Error("Status config error")

      const { error } = await supabase.from("transaction").insert({
        buyer_id: userId,
        listing_id: listing.listing_id,
        status_id: pendingStatus.status_id,
        buyer_confirm: false,
        seller_confirm: false,
      })
      if (error) throw error
      return listing.listing_id
    },
    onSuccess: (listingId) => {
      setJustBought((prev) => new Set([...prev, listingId]))
      setBuyingListing(null)
      queryClient.invalidateQueries({ queryKey: ["pending-ids", userId] })
    },
    onError: (err: Error) => {
      setBuyError(err.message)
    },
  })

  const sorted = [...listings].sort((a, b) => {
    switch (sortBy) {
      case "price_asc": return a.price - b.price
      case "price_desc": return b.price - a.price
      case "amount_asc": return Number(a.amount) - Number(b.amount)
      case "amount_desc": return Number(b.amount) - Number(a.amount)
      default: return new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime()
    }
  })

  const filtered = sorted.filter((l) => l.price <= priceMax && l.seller_net_id !== userId)

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Buy confirmation modal */}
      <AnimatePresence>
        {buyingListing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => { setBuyingListing(null); setBuyError("") }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1.5 bg-gradient-to-r from-[#57068c] to-[#8b2fc9]" />
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-black text-zinc-900">Confirm Purchase</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Request will be sent to the seller</p>
                  </div>
                  <button
                    onClick={() => { setBuyingListing(null); setBuyError("") }}
                    className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-4 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-zinc-500">Price per swipe</span>
                    <span className="font-black text-[#57068c] text-xl">${buyingListing.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-zinc-500">Quantity</span>
                    <span className="font-semibold text-zinc-800">{buyingListing.amount} swipe{Number(buyingListing.amount) !== 1 ? "s" : ""}</span>
                  </div>
                  {buyingListing.location && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">Meet at</span>
                      <span className="text-sm font-medium text-zinc-700 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#57068c]" />
                        {buyingListing.location.location}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-zinc-500">Seller</span>
                    <span className="text-sm font-medium text-zinc-700">{buyingListing.seller_net_id}@nyu.edu</span>
                  </div>
                  <div className="border-t border-zinc-200 pt-2 flex justify-between items-baseline">
                    <span className="text-sm font-semibold text-zinc-700">Total</span>
                    <span className="font-black text-zinc-900 text-lg">
                      ${(buyingListing.price * Number(buyingListing.amount)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {buyError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {buyError}
                  </div>
                )}

                {!userId ? (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    You must be logged in to buy swipes.
                  </div>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => buyMutation.mutate(buyingListing)}
                    disabled={buyMutation.isPending}
                  >
                    {buyMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Sending Request…</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4" />Send Buy Request</>
                    )}
                  </Button>
                )}
                <p className="text-[10px] text-zinc-400 text-center">
                  You'll coordinate the meetup with the seller after they accept.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 flex items-center gap-2">
              <UtensilsCrossed className="w-6 h-6 text-[#57068c]" />
              Available Swipes
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {isLoading ? "Loading..." : `${filtered.length} listing${filtered.length !== 1 ? "s" : ""} available`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-44 text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="amount_asc">Amount: Low to High</SelectItem>
                <SelectItem value="amount_desc">Amount: High to Low</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {showFilters && <X className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-zinc-100"
            >
              <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap gap-6 items-end">
                <div className="min-w-56">
                  <label className="block text-xs font-medium text-zinc-500 mb-2">
                    Max Price: <span className="text-[#57068c] font-bold">${priceMax}</span>
                  </label>
                  <Slider
                    value={priceMax}
                    min={1}
                    max={20}
                    step={0.5}
                    onChange={(e) => setPriceMax(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => setPriceMax(20)}>
                  Reset Filters
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
              <UtensilsCrossed className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-700 mb-1">No listings found</h3>
            <p className="text-zinc-400 text-sm">Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          >
            {filtered.map((listing) => {
              const alreadyRequested = pendingIds.has(listing.listing_id) || justBought.has(listing.listing_id)
              return (
                <motion.div key={listing.listing_id} variants={cardVariants} whileHover={{ y: -3 }}>
                  <Card className="relative h-full overflow-hidden border-zinc-200 hover:shadow-lg hover:border-[#57068c]/30 transition-all duration-200 group">
                    {listing.discount && listing.discount.discount_rate > 0 && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-bl-xl z-10">
                        -{Math.round(listing.discount.discount_rate * 100)}% OFF
                      </div>
                    )}
                    <div
                      className={`h-1 w-full ${
                        listing.urgency?.urgency === "Urgent" ? "bg-red-500" :
                        listing.urgency?.urgency === "High" ? "bg-orange-400" :
                        listing.urgency?.urgency === "Medium" ? "bg-amber-400" :
                        "bg-emerald-400"
                      }`}
                    />
                    <CardContent className="p-4 flex flex-col gap-3">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-[#57068c]">${listing.price.toFixed(2)}</span>
                          <span className="text-zinc-400 text-sm">× {listing.amount} swipe{Number(listing.amount) !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                          <TrendingDown className="w-3 h-3 text-emerald-500" />
                          <span>${listing.price.toFixed(2)}/ea</span>
                        </div>
                      </div>

                      {listing.type && (
                        <div className="text-xs text-zinc-600 font-medium bg-zinc-50 rounded-lg px-2.5 py-1.5 border border-zinc-100">
                          {listing.type.type}
                        </div>
                      )}

                      {listing.location && (
                        <div className="flex items-start gap-1.5 text-xs text-zinc-500">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#57068c]" />
                          <span className="leading-tight">{listing.location.location}</span>
                          {BUFFET_HALLS.has(listing.location.location) && (
                            <span className="ml-auto shrink-0 text-[9px] font-bold bg-violet-100 text-violet-700 rounded px-1 py-0.5">BUFFET</span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 items-center">
                        {listing.urgency && (
                          <Badge variant={urgencyBadgeVariant(listing.urgency.urgency)} className="text-[10px]">
                            {listing.urgency.urgency}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                          <Tag className="w-3 h-3" />
                          <span>{listing.seller_net_id}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 border-t border-zinc-100 pt-2.5">
                        <Clock className="w-3 h-3" />
                        <span>Expires {new Date(listing.expiration_date).toLocaleDateString()}</span>
                      </div>

                      {alreadyRequested ? (
                        <Button size="sm" variant="outline" className="w-full mt-1 gap-1.5 text-emerald-600 border-emerald-200 bg-emerald-50 cursor-default" disabled>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Request Sent
                        </Button>
                      ) : !userId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-1 gap-1.5"
                          onClick={() => router.push("/login")}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Log in to Buy
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full mt-1 gap-1.5"
                          onClick={() => { setBuyError(""); setBuyingListing(listing) }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Buy Swipe{Number(listing.amount) !== 1 ? "s" : ""}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </main>
    </div>
  )
}

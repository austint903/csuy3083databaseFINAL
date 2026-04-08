"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/utils/supabase/client"
import {
  MapPin, Clock, Tag, SlidersHorizontal, X, ChevronDown,
  UtensilsCrossed, TrendingDown, Filter
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

function urgencyBadgeVariant(urgency: string): "urgent" | "high" | "medium" | "low" | "norush" | "default" {
  const map: Record<string, "urgent" | "high" | "medium" | "low" | "norush"> = {
    Urgent: "urgent",
    High: "high",
    Medium: "medium",
    Low: "low",
    "No Rush": "norush",
  }
  return map[urgency] ?? "default"
}

async function fetchListings(): Promise<Listing[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("listing")
    .select(`
      listing_id,
      price,
      amount,
      is_active,
      posted_date,
      expiration_date,
      seller_net_id,
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
  const [priceMax, setPriceMax] = useState(20)
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [showFilters, setShowFilters] = useState(false)

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: fetchListings,
    refetchOnMount: "always",
  })

  const sorted = [...listings].sort((a, b) => {
    switch (sortBy) {
      case "price_asc": return a.price - b.price
      case "price_desc": return b.price - a.price
      case "amount_asc": return Number(a.amount) - Number(b.amount)
      case "amount_desc": return Number(b.amount) - Number(a.amount)
      case "newest":
      default:
        return new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime()
    }
  })

  const filtered = sorted.filter((l) => l.price <= priceMax)

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  }

  return (
    <div className="min-h-screen bg-zinc-50">
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
            <Select
              className="w-44 text-sm h-9"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="amount_asc">Amount: Low to High</option>
              <option value="amount_desc">Amount: High to Low</option>
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

        {/* Filter panel */}
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
            {filtered.map((listing) => (
              <motion.div key={listing.listing_id} variants={cardVariants} whileHover={{ y: -3 }}>
                <Card className="relative h-full overflow-hidden border-zinc-200 hover:shadow-lg hover:border-[#57068c]/30 transition-all duration-200 group cursor-pointer">
                  {/* Discount ribbon */}
                  {listing.discount && listing.discount.discount_rate > 0 && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-bl-xl z-10">
                      -{Math.round(listing.discount.discount_rate * 100)}% OFF
                    </div>
                  )}

                  {/* Color bar by urgency */}
                  <div
                    className={`h-1 w-full ${
                      listing.urgency?.urgency === "Urgent" ? "bg-red-500" :
                      listing.urgency?.urgency === "High" ? "bg-orange-400" :
                      listing.urgency?.urgency === "Medium" ? "bg-amber-400" :
                      "bg-emerald-400"
                    }`}
                  />

                  <CardContent className="p-4 flex flex-col gap-3">
                    {/* Price + amount */}
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-[#57068c]">
                          ${listing.price.toFixed(2)}
                        </span>
                        <span className="text-zinc-400 text-sm">
                          × {listing.amount} swipe{Number(listing.amount) !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                        <TrendingDown className="w-3 h-3 text-emerald-500" />
                        <span>${listing.price.toFixed(2)}/ea avg</span>
                      </div>
                    </div>

                    {/* Type */}
                    {listing.type && (
                      <div className="text-xs text-zinc-600 font-medium bg-zinc-50 rounded-lg px-2.5 py-1.5 border border-zinc-100">
                        {listing.type.type}
                      </div>
                    )}

                    {/* Location */}
                    {listing.location && (
                      <div className="flex items-start gap-1.5 text-xs text-zinc-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#57068c]" />
                        <span className="leading-tight">{listing.location.location}</span>
                      </div>
                    )}

                    {/* Badges row */}
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

                    {/* Expiry */}
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 border-t border-zinc-100 pt-2.5">
                      <Clock className="w-3 h-3" />
                      <span>Expires {new Date(listing.expiration_date).toLocaleDateString()}</span>
                    </div>

                    {/* CTA */}
                    <Button size="sm" className="w-full mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Request Swap
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  )
}

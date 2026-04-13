"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"
import {
  Plus, MapPin, Clock, Tag, CheckCircle2, Circle,
  PackageCheck, Loader2, AlertCircle, ChevronDown, ChevronUp, Bell
} from "lucide-react"

interface Listing {
  listing_id: string
  price: number
  amount: string
  is_active: boolean
  posted_date: string
  expiration_date: string
  seller_net_id: string
  location: { location_id: string; location: string } | null
  urgency: { urgency_id: string; urgency: string } | null
  type: { type_id: string; type: string } | null
  status_label?: "to_be_sold" | "ongoing" | "sold"
}

interface LocationRow { location_id: string; location: string }
interface UrgencyRow  { urgency_id: string; urgency: string }
interface TypeRow     { type_id: string; type: string }

async function fetchMyListings(userId: string): Promise<Listing[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("listing")
    .select(`
      listing_id, price, amount, is_active, posted_date, expiration_date, seller_net_id,
      location:preferred_location_id ( location_id, location ),
      urgency:urgency_id ( urgency_id, urgency ),
      type:type_id ( type_id, type )
    `)
    .eq("seller_net_id", userId)
    .order("posted_date", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Listing[]
}

async function fetchLookups() {
  const supabase = createClient()
  const [locations, urgencies, types] = await Promise.all([
    supabase.from("location").select("location_id, location"),
    supabase.from("urgency").select("urgency_id, urgency"),
    supabase.from("type").select("type_id, type"),
  ])
  return {
    locations: (locations.data ?? []) as LocationRow[],
    urgencies: (urgencies.data ?? []) as UrgencyRow[],
    types: (types.data ?? []) as TypeRow[],
  }
}

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  show: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" as const },
  }),
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h3 className="text-base font-bold text-zinc-900 dark:text-white">{title}</h3>
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-700 dark:bg-zinc-900 dark:text-white">{count}</span>
    </div>
  )
}

export default function SellPage() {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ locationId: "", urgencyId: "", typeId: "", qty: "", price: "" })
  const [formError, setFormError] = useState("")

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      // Use net_id from user metadata or email prefix as fallback
      const netId = data.user?.user_metadata?.net_id ?? data.user?.email?.split("@")[0] ?? null
      setUserId(netId)
    })
  }, [])

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["my-listings", userId],
    queryFn: () => fetchMyListings(userId!),
    enabled: !!userId,
  })

  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: fetchLookups,
  })

  const postMutation = useMutation({
    mutationFn: async () => {
      setFormError("")
      if (!userId || !form.locationId || !form.qty || !form.price) {
        throw new Error("Please fill in all required fields.")
      }
      const supabase = createClient()

      // Ensure a public.user row exists (SECURITY DEFINER bypasses RLS)
      const { error: userErr } = await supabase.rpc("ensure_current_user_row")
      if (userErr) throw new Error(`Could not create user profile: ${userErr.message}`)

      const { error } = await supabase.from("listing").insert({
        seller_net_id: userId,
        preferred_location_id: form.locationId,
        urgency_id: form.urgencyId || null,
        type_id: form.typeId || null,
        amount: form.qty,
        price: parseFloat(form.price),
        is_active: true,
        posted_date: new Date().toISOString(),
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-listings", userId] })
      setForm({ locationId: "", urgencyId: "", typeId: "", qty: "", price: "" })
      setShowForm(false)
    },
    onError: (err: Error) => {
      setFormError(err.message)
    },
  })

  const activeListing = listings.filter((l) => l.is_active)
  const inactiveListing = listings.filter((l) => !l.is_active)

  const { data: pendingOrderCount = 0 } = useQuery({
    queryKey: ["sell-pending-count", userId],
    queryFn: async () => {
      if (!userId) return 0
      const supabase = createClient()
      const { data: myListings } = await supabase.from("listing").select("listing_id").eq("seller_net_id", userId)
      if (!myListings || myListings.length === 0) return 0
      const ids = myListings.map((l: any) => l.listing_id)
      const { data: st } = await supabase.from("status").select("status_id").eq("status_name", "Pending").single()
      if (!st) return 0
      const { count } = await supabase
        .from("transaction")
        .select("transaction_id", { count: "exact", head: true })
        .in("listing_id", ids)
        .eq("status_id", (st as any).status_id)
      return count ?? 0
    },
    enabled: !!userId,
  })

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Pending orders banner */}
      {pendingOrderCount > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-700/30 dark:bg-amber-950/30">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Bell className="w-4 h-4" />
              <span className="text-sm font-semibold">
                {pendingOrderCount} new buy request{pendingOrderCount !== 1 ? "s" : ""} waiting for your response
              </span>
            </div>
            <Link href="/profile?tab=sales">
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-amber-300 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10"
              >
                View Requests →
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white">My Listings</h1>
            <p className="mt-0.5 text-sm font-medium text-zinc-600 dark:text-white">
              Manage your meal swipe postings
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="gap-2 w-full sm:w-auto"
          >
            {showForm ? <><Circle className="w-4 h-4" />Cancel</> : <><Plus className="w-4 h-4" />New Listing</>}
          </Button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800"
            >
              <div className="max-w-5xl mx-auto px-6 py-5">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-4 text-sm font-bold text-zinc-900 dark:text-white">Create New Listing</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-white">Location *</label>
                      <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select location…" />
                        </SelectTrigger>
                        <SelectContent>
                          {lookups?.locations.map((l) => (
                            <SelectItem key={l.location_id} value={l.location_id}>{l.location}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-white">Type</label>
                      <Select value={form.typeId || "__none__"} onValueChange={(v) => setForm({ ...form, typeId: v === "__none__" ? "" : v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Any type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Any type</SelectItem>
                          {lookups?.types.map((t) => (
                            <SelectItem key={t.type_id} value={t.type_id}>{t.type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-white">Urgency</label>
                      <Select value={form.urgencyId || "__none__"} onValueChange={(v) => setForm({ ...form, urgencyId: v === "__none__" ? "" : v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {lookups?.urgencies.map((u) => (
                            <SelectItem key={u.urgency_id} value={u.urgency_id}>{u.urgency}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-white">Qty *</label>
                      <Input
                        type="number"
                        placeholder="e.g. 3"
                        min={1}
                        value={form.qty}
                        onChange={(e) => setForm({ ...form, qty: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-white">Price/ea ($) *</label>
                      <Input
                        type="number"
                        placeholder="e.g. 5"
                        min={0.01}
                        step={0.01}
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                      />
                    </div>
                  </div>
                  {formError && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {formError}
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => postMutation.mutate()}
                      disabled={postMutation.isPending}
                      className="gap-2"
                      size="sm"
                    >
                      {postMutation.isPending ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Posting…</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" />Post Listing</>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Active listings */}
        <section>
          <SectionHeader title="Active Listings" count={activeListing.length} />
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : activeListing.length === 0 ? (
            <EmptyState
              icon={<Tag className="w-6 h-6 text-zinc-500 dark:text-white" />}
              message="No active listings. Create one to start selling."
            />
          ) : (
            <div className="space-y-3">
              {activeListing.map((listing, i) => (
                <ListingRow key={listing.listing_id} listing={listing} index={i} onDeactivate={async () => {
                  const supabase = createClient()
                  await supabase.from("listing").update({ is_active: false }).eq("listing_id", listing.listing_id)
                  queryClient.invalidateQueries({ queryKey: ["my-listings", userId] })
                }} />
              ))}
            </div>
          )}
        </section>

        {/* Inactive / sold */}
        <section>
          <SectionHeader title="Past Listings" count={inactiveListing.length} />
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : inactiveListing.length === 0 ? (
            <EmptyState
              icon={<PackageCheck className="w-6 h-6 text-zinc-500 dark:text-white" />}
              message="Your completed listings will appear here."
            />
          ) : (
            <div className="space-y-3 opacity-70">
              {inactiveListing.map((listing, i) => (
                <ListingRow key={listing.listing_id} listing={listing} index={i} inactive />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
      {icon}
      <p className="text-sm font-medium text-zinc-600 dark:text-white">{message}</p>
    </div>
  )
}

function ListingRow({
  listing, index, inactive = false, onDeactivate
}: {
  listing: Listing
  index: number
  inactive?: boolean
  onDeactivate?: () => void
}) {
  return (
    <motion.div
      custom={index}
      variants={rowVariants}
      initial="hidden"
      animate="show"
      whileHover={inactive ? {} : { x: 3 }}
    >
      <Card className={`overflow-hidden border-zinc-200 dark:border-zinc-800 ${inactive ? "bg-zinc-50 dark:bg-zinc-900/70" : "transition-shadow duration-200 hover:shadow-md dark:bg-zinc-900/80"}`}>
        <div className={`h-1 ${inactive ? "bg-zinc-300" : "bg-[#57068c]"}`} />
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Price */}
            <div className="min-w-[80px]">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white">Price</p>
              <p className="font-black text-[#57068c] text-lg">${listing.price.toFixed(2)}</p>
            </div>

            {/* Amount */}
            <div className="min-w-[70px]">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white">Swipes</p>
              <p className="font-bold text-zinc-900 dark:text-white">{listing.amount}</p>
            </div>

            {/* Location */}
            <div className="flex-1 min-w-[150px]">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white">Location</p>
              <div className="flex items-center gap-1 text-sm font-semibold text-zinc-800 dark:text-white">
                <MapPin className="w-3.5 h-3.5 text-[#57068c]" />
                {listing.location?.location ?? "—"}
              </div>
            </div>

            {/* Type */}
            {listing.type && (
              <div className="min-w-[120px]">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white">Type</p>
                <p className="text-xs font-medium text-zinc-700 dark:text-white">{listing.type.type}</p>
              </div>
            )}

            {/* Urgency */}
            {listing.urgency && (
              <div>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white">Urgency</p>
                <Badge
                  variant={
                    listing.urgency.urgency === "Urgent" ? "urgent" :
                    listing.urgency.urgency === "High" ? "high" :
                    listing.urgency.urgency === "Medium" ? "medium" :
                    "low"
                  }
                  className="text-[10px]"
                >
                  {listing.urgency.urgency}
                </Badge>
              </div>
            )}

            {/* Date */}
            <div className="min-w-[100px]">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-white">Posted</p>
              <div className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-white">
                <Clock className="w-3 h-3" />
                {new Date(listing.posted_date).toLocaleDateString()}
              </div>
            </div>

            {/* Status / actions */}
            <div className="ml-auto flex items-center gap-2">
              {inactive ? (
                <Badge variant="sold" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Inactive
                </Badge>
              ) : (
                <>
                  <Badge variant="active" className="gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </Badge>
                  {onDeactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs font-medium text-zinc-500 hover:text-red-500 dark:text-white dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      onClick={onDeactivate}
                    >
                      Deactivate
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

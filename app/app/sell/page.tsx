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
  PackageCheck, Loader2, AlertCircle, Bell, Pencil,
  Save, Trash2, X
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
  preferred_location_id: string
  urgency_id: string | null
  type_id: string | null
}

interface LocationRow { location_id: string; location: string }
interface UrgencyRow  { urgency_id: string; urgency: string }
interface TypeRow     { type_id: string; type: string }

interface EditState {
  locationId: string
  urgencyId: string
  typeId: string
  amount: string
  price: string
}

async function fetchMyListings(userId: string): Promise<Listing[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("listing")
    .select(`
      listing_id, price, amount, is_active, posted_date, expiration_date, seller_net_id,
      preferred_location_id, urgency_id, type_id,
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
  hidden: { opacity: 0, x: -12 },
  show: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.06, duration: 0.28, ease: "easeOut" as const },
  }),
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{count}</span>
    </div>
  )
}

export default function SellPage() {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ locationId: "", urgencyId: "", typeId: "", qty: "", price: "" })
  const [formError, setFormError] = useState("")

  // Edit modal state
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saveError, setSaveError] = useState("")
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: EditState }) => {
      if (!userId) throw new Error("You must be logged in.")
      const amount = Number(state.amount)
      const price = Number(state.price)
      if (!state.locationId) throw new Error("Choose a location.")
      if (!Number.isInteger(amount) || amount < 1) throw new Error("Enter a whole number of swipes.")
      if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price.")
      const supabase = createClient()
      const { data, error } = await supabase
        .from("listing")
        .update({
          preferred_location_id: state.locationId,
          urgency_id: state.urgencyId || null,
          type_id: state.typeId || null,
          amount: amount.toString(),
          price,
        })
        .eq("listing_id", id)
        .eq("seller_net_id", userId)
        .select("listing_id")
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error("You can only edit listings you posted.")
    },
    onSuccess: () => {
      setJustSaved(true)
      queryClient.invalidateQueries({ queryKey: ["my-listings", userId] })
      setTimeout(closeModal, 900)
    },
    onError: (err: Error) => {
      setSaveError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("listing").delete().eq("listing_id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-listings", userId] })
      closeModal()
    },
  })

  function openEdit(listing: Listing) {
    setEditingListing(listing)
    setEditState({
      locationId: listing.preferred_location_id ?? "",
      urgencyId: listing.urgency_id ?? "",
      typeId: listing.type_id ?? "",
      amount: listing.amount,
      price: listing.price.toString(),
    })
    setSaveError("")
    setJustSaved(false)
  }

  function closeModal() {
    setEditingListing(null)
    setEditState(null)
    setSaveError("")
    setJustSaved(false)
  }

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
    <div className="min-h-screen bg-background">
      {/* Edit modal */}
      <AnimatePresence>
        {editingListing && editState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 bg-brand" />
              <div className="p-6 flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Edit Listing</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {editingListing.location?.location ?? "—"} · ${editingListing.price.toFixed(2)} × {editingListing.amount} swipe{Number(editingListing.amount) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-muted-foreground transition-colors hover:text-foreground rounded-md p-1 hover:bg-accent"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Location *</label>
                    <Select value={editState.locationId} onValueChange={(v) => setEditState({ ...editState, locationId: v })}>
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
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
                    <Select value={editState.typeId || "__none__"} onValueChange={(v) => setEditState({ ...editState, typeId: v === "__none__" ? "" : v })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {lookups?.types.map((t) => (
                          <SelectItem key={t.type_id} value={t.type_id}>{t.type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Urgency</label>
                    <Select value={editState.urgencyId || "__none__"} onValueChange={(v) => setEditState({ ...editState, urgencyId: v === "__none__" ? "" : v })}>
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
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Swipes *</label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={editState.amount}
                      onChange={(e) => setEditState({ ...editState, amount: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Price/ea ($) *</label>
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={editState.price}
                      onChange={(e) => setEditState({ ...editState, price: e.target.value })}
                    />
                  </div>
                </div>

                {saveError && (
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {saveError}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <Button
                    className="flex-1 gap-2"
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: editingListing.listing_id, state: editState })}
                    disabled={updateMutation.isPending || justSaved}
                  >
                    {updateMutation.isPending ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                    ) : justSaved ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" />Saved!</>
                    ) : (
                      <><Save className="w-3.5 h-3.5" />Save Changes</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate(editingListing.listing_id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending orders banner */}
      {pendingOrderCount > 0 && (
        <div className="border-b border-amber-500/20 bg-amber-500/10">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Bell className="w-4 h-4" />
              <span className="text-sm font-medium">
                {pendingOrderCount} new buy request{pendingOrderCount !== 1 ? "s" : ""} waiting for your response
              </span>
            </div>
            <Link href="/profile?tab=sales">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              >
                View →
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">My Listings</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage your meal swipe postings</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2 w-full sm:w-auto" size="sm">
            {showForm ? <><Circle className="w-3.5 h-3.5" />Cancel</> : <><Plus className="w-3.5 h-3.5" />New Listing</>}
          </Button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="max-w-5xl mx-auto px-6 py-5">
                <div className="rounded-xl border border-border bg-muted/40 p-5">
                  <p className="mb-4 text-sm font-medium text-foreground">Create New Listing</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Location *</label>
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
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
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
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Urgency</label>
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
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Qty *</label>
                      <Input
                        type="number"
                        placeholder="e.g. 3"
                        min={1}
                        value={form.qty}
                        onChange={(e) => setForm({ ...form, qty: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Price/ea ($) *</label>
                      <Input
                        type="number"
                        placeholder="e.g. 5.00"
                        min={0.01}
                        step={0.01}
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: e.target.value })}
                      />
                    </div>
                  </div>
                  {formError && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
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
              icon={<Tag className="w-6 h-6 text-muted-foreground" />}
              message="No active listings. Create one to start selling."
            />
          ) : (
            <div className="space-y-3">
              {activeListing.map((listing, i) => (
                <ListingRow
                  key={listing.listing_id}
                  listing={listing}
                  index={i}
                  onEdit={() => openEdit(listing)}
                  onDeactivate={async () => {
                    const supabase = createClient()
                    await supabase.from("listing").update({ is_active: false }).eq("listing_id", listing.listing_id)
                    queryClient.invalidateQueries({ queryKey: ["my-listings", userId] })
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Past listings */}
        <section>
          <SectionHeader title="Past Listings" count={inactiveListing.length} />
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : inactiveListing.length === 0 ? (
            <EmptyState
              icon={<PackageCheck className="w-6 h-6 text-muted-foreground" />}
              message="Your completed listings will appear here."
            />
          ) : (
            <div className="space-y-3 opacity-60">
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
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border py-12 text-center">
      {icon}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function ListingRow({
  listing, index, inactive = false, onEdit, onDeactivate
}: {
  listing: Listing
  index: number
  inactive?: boolean
  onEdit?: () => void
  onDeactivate?: () => void
}) {
  return (
    <motion.div
      custom={index}
      variants={rowVariants}
      initial="hidden"
      animate="show"
      whileHover={inactive ? {} : { x: 2 }}
    >
      <Card className={`overflow-hidden border-border ${inactive ? "bg-muted/20" : "bg-card transition-shadow duration-200 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20"}`}>
        <div className={`h-0.5 ${inactive ? "bg-border" : "bg-brand"}`} />
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Price */}
            <div className="min-w-[80px]">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Price</p>
              <p className="font-bold text-brand text-lg">${listing.price.toFixed(2)}</p>
            </div>

            {/* Amount */}
            <div className="min-w-[64px]">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Swipes</p>
              <p className="font-semibold text-foreground">{listing.amount}</p>
            </div>

            {/* Location */}
            <div className="flex-1 min-w-[150px]">
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Location</p>
              <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                <MapPin className="w-3.5 h-3.5 text-brand" />
                {listing.location?.location ?? "—"}
              </div>
            </div>

            {/* Type */}
            {listing.type && (
              <div className="min-w-[120px]">
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Type</p>
                <p className="text-xs text-foreground/80">{listing.type.type}</p>
              </div>
            )}

            {/* Urgency */}
            {listing.urgency && (
              <div>
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Urgency</p>
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
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Posted</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {new Date(listing.posted_date).toLocaleDateString()}
              </div>
            </div>

            {/* Actions */}
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
                  {onEdit && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={onEdit}>
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                  )}
                  {onDeactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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

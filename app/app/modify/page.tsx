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
import {
  Trash2, Save, Loader2, AlertCircle, CheckCircle2,
  MapPin, ArrowLeft, Pencil, X, Clock, Tag
} from "lucide-react"
import Link from "next/link"

interface Listing {
  listing_id: string
  price: number
  amount: string
  is_active: boolean
  seller_net_id: string
  preferred_location_id: string
  urgency_id: string | null
  type_id: string | null
  posted_date: string
  location: { location_id: string; location: string } | null
  urgency: { urgency_id: string; urgency: string } | null
  type: { type_id: string; type: string } | null
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
      listing_id, price, amount, is_active, seller_net_id, posted_date,
      preferred_location_id, urgency_id, type_id,
      location:preferred_location_id ( location_id, location ),
      urgency:urgency_id ( urgency_id, urgency ),
      type:type_id ( type_id, type )
    `)
    .eq("seller_net_id", userId)
    .eq("is_active", true)
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

export default function ModifyPage() {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
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
    queryKey: ["modify-listings", userId],
    queryFn: () => fetchMyListings(userId!),
    enabled: !!userId,
  })

  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: fetchLookups,
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: EditState }) => {
      if (!userId) throw new Error("You must be logged in to edit listings.")
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
      queryClient.invalidateQueries({ queryKey: ["modify-listings", userId] })
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
      queryClient.invalidateQueries({ queryKey: ["modify-listings", userId] })
      closeModal()
    },
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
                {/* Modal header */}
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

                {/* Fields */}
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

                {/* Actions */}
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
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/sell">
              <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>
            </Link>
          </div>
          <h1 className="text-xl font-bold text-foreground">Edit Listings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Click a listing to edit it</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed border-border text-center gap-3">
            <MapPin className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">No active listings to edit.</p>
            <Link href="/sell">
              <Button variant="outline" size="sm">Go to Sell Page</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((listing, i) => (
              <motion.div key={listing.listing_id} custom={i} variants={rowVariants} initial="hidden" animate="show" whileHover={{ x: 2 }}>
                <Card className="overflow-hidden border-border bg-card transition-shadow duration-200 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 cursor-pointer" onClick={() => openEdit(listing)}>
                  <div className="h-0.5 bg-brand" />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="min-w-[80px]">
                        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Price</p>
                        <p className="font-bold text-brand text-lg">${listing.price.toFixed(2)}</p>
                      </div>

                      <div className="min-w-[64px]">
                        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Swipes</p>
                        <p className="font-semibold text-foreground">{listing.amount}</p>
                      </div>

                      <div className="flex-1 min-w-[150px]">
                        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Location</p>
                        <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                          <MapPin className="w-3.5 h-3.5 text-brand" />
                          {listing.location?.location ?? "—"}
                        </div>
                      </div>

                      {listing.type && (
                        <div className="min-w-[120px]">
                          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Type</p>
                          <p className="text-xs text-foreground/80">{listing.type.type}</p>
                        </div>
                      )}

                      <div className="min-w-[100px]">
                        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Posted</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(listing.posted_date).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="ml-auto flex items-center gap-2">
                        <Badge variant="active" className="gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 text-xs text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); openEdit(listing) }}
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

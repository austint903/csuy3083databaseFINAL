"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, type Variants } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/utils/supabase/client"
import { Trash2, Save, Loader2, AlertCircle, CheckCircle2, MapPin, ArrowLeft } from "lucide-react"
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
  location: { location_id: string; location: string } | null
  urgency: { urgency_id: string; urgency: string } | null
  type: { type_id: string; type: string } | null
}

interface LocationRow { location_id: string; location: string }
interface UrgencyRow  { urgency_id: string; urgency: string }
interface TypeRow     { type_id: string; type: string }

async function fetchMyListings(userId: string): Promise<Listing[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("listing")
    .select(`
      listing_id, price, amount, is_active, seller_net_id,
      preferred_location_id, urgency_id, type_id,
      location:preferred_location_id ( location_id, location ),
      urgency:urgency_id ( urgency_id, urgency ),
      type:type_id ( type_id, type )
    `)
    .eq("seller_net_id", userId)
    .eq("is_active", true)
    .order("price", { ascending: true })

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

interface EditState {
  locationId: string
  urgencyId: string
  typeId: string
  amount: string
  price: string
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.3, ease: "easeOut" as const },
  }),
}

export default function ModifyPage() {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [editStates, setEditStates] = useState<Record<string, EditState>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

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

  useEffect(() => {
    if (listings.length > 0) {
      const states: Record<string, EditState> = {}
      listings.forEach((l) => {
        if (!editStates[l.listing_id]) {
          states[l.listing_id] = {
            locationId: l.preferred_location_id ?? "",
            urgencyId: l.urgency_id ?? "",
            typeId: l.type_id ?? "",
            amount: l.amount,
            price: l.price.toString(),
          }
        }
      })
      if (Object.keys(states).length > 0) {
        setEditStates((prev) => ({ ...states, ...prev }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings.length])

  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: fetchLookups,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: EditState }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("listing")
        .update({
          preferred_location_id: state.locationId,
          urgency_id: state.urgencyId || null,
          type_id: state.typeId || null,
          amount: state.amount,
          price: parseFloat(state.price),
        })
        .eq("listing_id", id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      setSaved((prev) => ({ ...prev, [id]: true }))
      setTimeout(() => setSaved((prev) => ({ ...prev, [id]: false })), 2000)
      queryClient.invalidateQueries({ queryKey: ["modify-listings", userId] })
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
    },
  })

  const setField = (id: string, field: keyof EditState, value: string) => {
    setEditStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  return (
    <div className="min-h-screen bg-background">
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
          <p className="text-sm text-muted-foreground mt-0.5">Modify your active listings below</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
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
          <div className="space-y-4">
            {listings.map((listing, i) => {
              const state = editStates[listing.listing_id] ?? {
                locationId: listing.preferred_location_id ?? "",
                urgencyId: listing.urgency_id ?? "",
                typeId: listing.type_id ?? "",
                amount: listing.amount,
                price: listing.price.toString(),
              }
              const isSaving = updateMutation.isPending && updateMutation.variables?.id === listing.listing_id
              const isDeleting = deleteMutation.isPending && deleteMutation.variables === listing.listing_id
              const wasSaved = saved[listing.listing_id]

              return (
                <motion.div key={listing.listing_id} custom={i} variants={cardVariants} initial="hidden" animate="show">
                  <Card className="border-border bg-card overflow-hidden hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 transition-shadow duration-200">
                    <div className="h-0.5 bg-brand" />
                    <CardContent className="p-5">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <Badge variant="active" className="gap-1 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{listing.listing_id.slice(0, 8)}…</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => deleteMutation.mutate(listing.listing_id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Fields */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                        <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                          <label className="block text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Location</label>
                          <Select value={state.locationId} onValueChange={(v) => setField(listing.listing_id, "locationId", v)}>
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
                          <label className="block text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Type</label>
                          <Select value={state.typeId || "__none__"} onValueChange={(v) => setField(listing.listing_id, "typeId", v === "__none__" ? "" : v)}>
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
                          <label className="block text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Urgency</label>
                          <Select value={state.urgencyId || "__none__"} onValueChange={(v) => setField(listing.listing_id, "urgencyId", v === "__none__" ? "" : v)}>
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
                          <label className="block text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Amount</label>
                          <Input
                            type="number"
                            min={1}
                            value={state.amount}
                            onChange={(e) => setField(listing.listing_id, "amount", e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Price ($)</label>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={state.price}
                            onChange={(e) => setField(listing.listing_id, "price", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Save row */}
                      <div className="flex items-center gap-3 pt-3 border-t border-border">
                        <Button
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: listing.listing_id, state })}
                          disabled={isSaving}
                          className="gap-2"
                        >
                          {isSaving ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                          ) : wasSaved ? (
                            <><CheckCircle2 className="w-3.5 h-3.5" />Saved!</>
                          ) : (
                            <><Save className="w-3.5 h-3.5" />Save Changes</>
                          )}
                        </Button>
                        {updateMutation.isError && updateMutation.variables?.id === listing.listing_id && (
                          <p className="flex items-center gap-1.5 text-destructive text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Failed to save
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/utils/supabase/client"
import { UtensilsCrossed, Clock } from "lucide-react"

interface DiningHall {
  hall_name: string
  hall_slug: string
  hours: Record<string, string> | null
}

interface MenuItem {
  name: string
  category: string
}

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const
const DAY_LABELS: Record<string, string> = {
  monday:"Mon", tuesday:"Tue", wednesday:"Wed",
  thursday:"Thu", friday:"Fri", saturday:"Sat", sunday:"Sun"
}

function mealLabel(period: string) {
  const map: Record<string,string> = {
    breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
    brunch: "Brunch", supper: "Supper",
    "every-day": "All Day", everyday: "All Day",
  }
  return map[period] ?? period.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0]
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })
}

/** Collapse consecutive days with identical hours into ranges like "Mon–Thu". */
function compactHours(hours: Record<string, string>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  let i = 0
  while (i < DAYS.length) {
    const val = hours[DAYS[i]] ?? "Closed"
    let j = i + 1
    while (j < DAYS.length && (hours[DAYS[j]] ?? "Closed") === val) j++
    const label =
      j - i === 1
        ? DAY_LABELS[DAYS[i]]
        : `${DAY_LABELS[DAYS[i]]}–${DAY_LABELS[DAYS[j - 1]]}`
    rows.push({ label, value: val })
    i = j
  }
  return rows
}

async function fetchHalls(today: string): Promise<{ halls: DiningHall[]; date: string }> {
  const supabase = createClient()

  let { data: menuRows } = await supabase
    .from("dining_menu")
    .select("hall_name, hall_slug")
    .eq("date", today)
    .order("hall_name")

  let usedDate = today

  // Fall back to most recent available date if today has no data
  if (!menuRows?.length) {
    const { data: latestRow } = await supabase
      .from("dining_menu")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .single()

    if (!latestRow) return { halls: [], date: today }

    usedDate = latestRow.date
    const { data: fallbackRows } = await supabase
      .from("dining_menu")
      .select("hall_name, hall_slug")
      .eq("date", usedDate)
      .order("hall_name")

    menuRows = fallbackRows
  }

  if (!menuRows?.length) return { halls: [], date: today }

  const seen = new Set<string>()
  const unique = (menuRows as DiningHall[]).filter(r => {
    if (seen.has(r.hall_slug)) return false
    seen.add(r.hall_slug)
    return true
  })

  // Fetch hours from dining_halls
  const slugs = unique.map(r => r.hall_slug)
  const { data: hallRows } = await supabase
    .from("dining_halls")
    .select("slug, hours")
    .in("slug", slugs)

  const hoursMap: Record<string, Record<string,string>> = {}
  for (const h of (hallRows ?? []) as { slug: string; hours: Record<string,string> }[]) {
    hoursMap[h.slug] = h.hours
  }

  return { halls: unique.map(r => ({ ...r, hours: hoursMap[r.hall_slug] ?? null })), date: usedDate }
}

async function fetchMealPeriods(today: string, hallSlug: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("dining_menu")
    .select("meal_period")
    .eq("date", today)
    .eq("hall_slug", hallSlug)
    .order("meal_period")
  const order = ["breakfast","brunch","lunch","supper","dinner","every-day","everyday"]
  const periods = [...new Set((data ?? []).map((r: any) => r.meal_period as string))]
  return periods.sort((a, b) => {
    const ai = order.indexOf(a); const bi = order.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

async function fetchMenu(today: string, hallSlug: string, meal: string): Promise<MenuItem[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("dining_menu")
    .select("items")
    .eq("date", today)
    .eq("hall_slug", hallSlug)
    .eq("meal_period", meal)
    .single()
  return ((data as any)?.items ?? []) as MenuItem[]
}

const containerVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
}
const itemVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
}

function MenuItemSkeleton() {
  return (
    <Card className="border-border">
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}

export default function MenuPage() {
  const today = getTodayDate()
  const [selectedHall, setSelectedHall] = useState<string | null>(null)
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null)

  const { data: hallsResult, isLoading: hallsLoading } = useQuery({
    queryKey: ["dining_halls", today],
    queryFn: () => fetchHalls(today),
    staleTime: 1000 * 60 * 30,
  })

  const halls = hallsResult?.halls ?? []
  const resolvedDate = hallsResult?.date ?? today

  const { data: mealPeriods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["dining_meal_periods", resolvedDate, selectedHall],
    queryFn: () => fetchMealPeriods(resolvedDate, selectedHall!),
    enabled: !!selectedHall && !!resolvedDate,
    staleTime: 1000 * 60 * 30,
  })

  const { data: items = [], isLoading: menuLoading } = useQuery({
    queryKey: ["dining_menu", resolvedDate, selectedHall, selectedMeal],
    queryFn: () => fetchMenu(resolvedDate, selectedHall!, selectedMeal!),
    enabled: !!selectedHall && !!selectedMeal && !!resolvedDate,
    staleTime: 1000 * 60 * 30,
  })

  // Default to first hall
  useEffect(() => {
    if (halls.length > 0 && !selectedHall) setSelectedHall(halls[0].hall_slug)
  }, [halls, selectedHall])

  // Default to first meal period when hall changes
  useEffect(() => {
    if (mealPeriods.length > 0) setSelectedMeal(mealPeriods[0])
  }, [mealPeriods])

  const selectedHallData = halls.find(h => h.hall_slug === selectedHall) ?? null
  const noData  = !hallsLoading && halls.length === 0
  const isEmpty = !menuLoading && !!selectedHall && !!selectedMeal && items.length === 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">NYU Dining Menus</h1>
            {resolvedDate && resolvedDate !== today && (
              <p className="text-xs text-muted-foreground mt-1">
                Showing menu for {formatDate(resolvedDate)} — today's menu isn't available yet.
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-xs shrink-0 mt-1 gap-1">
            <UtensilsCrossed className="w-3 h-3" />
            NYU Eats
          </Badge>
        </div>

        {/* Hall tabs */}
        {hallsLoading ? (
          <div className="flex gap-2 mb-6 flex-wrap">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-28 rounded-lg" />)}
          </div>
        ) : halls.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {halls.map(hall => (
              <button
                key={hall.hall_slug}
                onClick={() => setSelectedHall(hall.hall_slug)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
                  selectedHall === hall.hall_slug
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {hall.hall_name}
              </button>
            ))}
          </div>
        )}

        {/* Hours + meal period row */}
        {!noData && selectedHallData && (
          <div className="mb-8 flex flex-col sm:flex-row gap-4 sm:items-start">

            {/* Meal period tabs */}
            {periodsLoading ? (
              <div className="flex gap-2 flex-wrap">
                {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {mealPeriods.map(period => (
                  <button
                    key={period}
                    onClick={() => setSelectedMeal(period)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer ${
                      selectedMeal === period
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {mealLabel(period)}
                  </button>
                ))}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Hours card */}
            {selectedHallData.hours && (
              <div className="rounded-lg border border-border bg-card p-3 min-w-[200px]">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Hours
                </p>
                <div className="space-y-0.5">
                  {compactHours(selectedHallData.hours).map(({ label, value }) => (
                    <div key={label} className="flex items-baseline justify-between gap-4">
                      <span className="text-xs font-medium text-foreground w-16 shrink-0">{label}</span>
                      <span className={`text-xs ${value === "Closed" ? "text-destructive" : "text-muted-foreground"}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No data state */}
        {noData && (
          <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Menu not available yet</p>
              <p className="text-sm text-muted-foreground mt-1">Menus are loaded daily at noon — check back later.</p>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {!noData && menuLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => <MenuItemSkeleton key={i} />)}
          </div>
        )}

        {/* Empty meal period */}
        {isEmpty && !menuLoading && (
          <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Nothing on the menu</p>
              <p className="text-sm text-muted-foreground mt-1">Try a different meal period or dining hall.</p>
            </div>
          </div>
        )}

        {/* Item grid */}
        {!menuLoading && items.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedHall}-${selectedMeal}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            >
              {items.map((item, idx) => (
                <motion.div key={`${item.name}-${idx}`} variants={itemVariants}>
                  <Card className="h-full border-border hover:shadow-md transition-shadow duration-200">
                    <CardContent className="p-4 space-y-1.5">
                      {item.category && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0 h-5 font-medium text-muted-foreground"
                        >
                          {item.category}
                        </Badge>
                      )}
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {item.name}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

      </div>
    </div>
  )
}

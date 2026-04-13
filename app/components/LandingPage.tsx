"use client"

import Link from "next/link"
import { motion, type Variants } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ModeToggle } from "@/components/mode-toggle"
import { ArrowRight, ShoppingCart, Tag, Shield, Zap, TrendingDown } from "lucide-react"

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}

const features = [
  {
    icon: ShoppingCart,
    title: "Buy Swipes",
    description: "Get meal swipes below dining-plan rates. Pay less, eat the same.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Tag,
    title: "Sell Swipes",
    description: "Turn leftover swipes into cash before they expire.",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  {
    icon: Shield,
    title: "Verified Students",
    description: "Only verified university students can join and trade.",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  {
    icon: Zap,
    title: "Instant Matching",
    description: "Post a listing and get matched with buyers near your location.",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
]

const stats = [
  { value: "500+", label: "Active Students" },
  { value: "$3–7", label: "Avg Swipe Price" },
  { value: "1,200+", label: "Swipes Traded" },
  { value: "4.9★", label: "Avg Rating" },
]

interface LandingPageProps {
  isLoggedIn: boolean
}

export function LandingPage({ isLoggedIn }: LandingPageProps) {
  const navOutlineHref = isLoggedIn ? "/profile" : "/login"
  const navOutlineLabel = isLoggedIn ? "Profile" : "Log In"
  const navPrimaryHref = isLoggedIn ? "/sell" : "/login"
  const navPrimaryLabel = isLoggedIn ? "Sell Swipes" : "Get Started"
  const heroPrimaryHref = isLoggedIn ? "/sell" : "/login"
  const heroPrimaryLabel = isLoggedIn ? "Sell Swipes" : "Get Started Free"
  const ctaHref = isLoggedIn ? "/buy" : "/login"
  const ctaLabel = isLoggedIn ? "Go to Marketplace" : "Log In with University SSO"

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/80 bg-background/85 px-6 backdrop-blur-md md:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-white text-sm font-black">S</span>
          </div>
          <span className="text-base font-bold text-foreground">
            Swipe<span className="text-primary">Market</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Link href="/buy">
            <Button variant="ghost" size="sm">Browse</Button>
          </Link>
          <Link href={navOutlineHref}>
            <Button variant="outline" size="sm">{navOutlineLabel}</Button>
          </Link>
          <Link href={navPrimaryHref}>
            <Button size="sm" className="hidden sm:flex">{navPrimaryLabel}</Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-800 to-stone-800 px-6 py-24 md:py-36">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-sky-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-amber-200/10 blur-3xl" />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-7 text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge variant="glass" className="gap-1.5 px-3 py-1 text-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              University Students Only
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl font-black leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl"
          >
            Trade Meal Swipes.
            <br />
            <span className="text-slate-200">Save Real Money.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-lg text-lg leading-relaxed text-slate-300/85"
          >
            The peer-to-peer marketplace for university meal swipes. Buy cheap, sell extra — never let a swipe expire again.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3">
            <Link href={heroPrimaryHref}>
              <Button size="lg" variant="white" className="gap-2 font-semibold shadow-lg shadow-black/20">
                {heroPrimaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/buy">
              <Button size="lg" variant="glass" className="gap-2 font-semibold">
                Browse Listings
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <section className="border-b border-border bg-card">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4 md:gap-0 md:divide-x md:divide-border"
        >
          {stats.map((s) => (
            <div key={s.label} className="px-4 text-center">
              <div className="text-3xl font-black text-primary">{s.value}</div>
              <div className="mt-0.5 text-sm text-zinc-500">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="bg-zinc-50 px-6 py-24">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-5xl"
        >
          <motion.div variants={fadeUp} className="mb-14 text-center">
            <h2 className="text-3xl font-black text-zinc-900 md:text-4xl">How it works</h2>
            <p className="mx-auto mt-3 max-w-md text-base text-zinc-500">
              Simple, fast, and built for university students.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <motion.div key={feature.title} variants={fadeUp}>
                <Card className="h-full border-zinc-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="p-6">
                    <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${feature.color}`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-2 font-bold text-zinc-900">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-zinc-500">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="bg-white px-6 py-24">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-3xl"
        >
          <motion.div variants={fadeUp} className="mb-14 text-center">
            <h2 className="text-3xl font-black text-zinc-900 md:text-4xl">Three simple steps</h2>
          </motion.div>
          <div className="space-y-6">
            {[
              { step: "01", title: "Sign in with your university account", desc: "Verified automatically — no extra steps." },
              { step: "02", title: "Browse or post a listing", desc: "Find swipes near your location, or post your extras in seconds." },
              { step: "03", title: "Meet up and trade", desc: "Confirm the swap, get paid or fed. Rate your experience." },
            ].map((item) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                className="flex items-start gap-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
                  {item.step}
                </div>
                <div className="pt-1">
                  <h3 className="mb-1 font-bold text-zinc-900">{item.title}</h3>
                  <p className="text-sm text-zinc-500">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-stone-800 px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto flex max-w-lg flex-col items-center gap-5"
        >
          <TrendingDown className="h-10 w-10 text-slate-300" />
          <h2 className="text-3xl font-black text-white md:text-4xl">Ready to start saving?</h2>
          <p className="text-base text-slate-300">
            Join hundreds of students already trading swipes on campus.
          </p>
          <Link href={ctaHref}>
            <Button size="lg" variant="white" className="gap-2 font-semibold shadow-lg shadow-black/20">
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-border bg-card px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <span className="text-white text-xs font-black">S</span>
            </div>
            <span className="text-sm font-medium text-zinc-500">SwipeMarket</span>
          </div>
          <p className="text-xs text-zinc-400">Not affiliated with any official university dining program. For students, by students.</p>
        </div>
      </footer>
    </div>
  )
}

"use client"

import Link from "next/link"
import { motion, type Variants } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ModeToggle } from "@/components/mode-toggle"
import { ArrowRight, ShoppingCart, Tag, Shield, Zap, TrendingDown, UtensilsCrossed, MessageSquare } from "lucide-react"

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
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
    color: "bg-brand/10 text-brand",
  },
  {
    icon: Tag,
    title: "Sell Swipes",
    description: "Turn leftover swipes into cash before they expire.",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Shield,
    title: "Verified Students",
    description: "Only verified university students can join and trade.",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    icon: Zap,
    title: "Fast Matching",
    description: "Post a listing and get matched with buyers near your location.",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
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
      {/* Nav */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/80 bg-background/85 px-6 backdrop-blur-md md:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <UtensilsCrossed className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground">
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

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-stone-900 px-6 py-24 md:py-36">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-amber-500/8 blur-3xl" />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge variant="glass" className="gap-1.5 px-3 py-1 text-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              University Students Only
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl font-black leading-[1.05] tracking-tight text-white md:text-6xl"
          >
            Trade Meal Swipes.
            <br />
            <span className="text-slate-300">Save Real Money.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-md text-base leading-relaxed text-slate-400"
          >
            The peer-to-peer marketplace for university meal swipes. Buy cheap, sell extra — never let a swipe expire again.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3">
            <Link href={heroPrimaryHref}>
              <Button size="lg" variant="white" className="gap-2 font-semibold shadow-lg shadow-black/30">
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

      {/* Features */}
      <section className="bg-background px-6 py-20">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto max-w-5xl"
        >
          <motion.div variants={fadeUp} className="mb-12 text-center">
            <h2 className="text-2xl font-black text-foreground md:text-3xl">How it works</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Simple, fast, and built for university students.
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <motion.div key={feature.title} variants={fadeUp}>
                <Card className="h-full border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20">
                  <CardContent className="p-5">
                    <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl ${feature.color}`}>
                      <feature.icon className="h-4 w-4" />
                    </div>
                    <h3 className="mb-1.5 text-sm font-bold text-foreground">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Steps */}
      <section className="bg-card border-y border-border px-6 py-20">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto max-w-2xl"
        >
          <motion.div variants={fadeUp} className="mb-12 text-center">
            <h2 className="text-2xl font-black text-foreground md:text-3xl">Three simple steps</h2>
          </motion.div>
          <div className="space-y-5">
            {[
              { step: "01", title: "Sign in with your university account", desc: "Verified automatically — no extra steps." },
              { step: "02", title: "Browse or post a listing", desc: "Find swipes near your location, or post your extras in seconds." },
              { step: "03", title: "Meet up and trade", desc: "Confirm the swap, get paid or fed. Rate your experience." },
            ].map((item) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                className="flex items-start gap-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-xs font-black text-brand">
                  {item.step}
                </div>
                <div className="pt-0.5">
                  <h3 className="mb-0.5 text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>


      {/* CTA */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-stone-900 px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto flex max-w-lg flex-col items-center gap-4"
        >
          <TrendingDown className="h-8 w-8 text-slate-400" />
          <h2 className="text-2xl font-black text-white md:text-3xl">Ready to start saving?</h2>
          <p className="text-sm text-slate-400">
            Join hundreds of students already trading swipes on campus.
          </p>
          <Link href={ctaHref}>
            <Button size="lg" variant="white" className="gap-2 font-semibold shadow-lg shadow-black/30 mt-2">
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary">
              <UtensilsCrossed className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">SwipeMarket</span>
          </div>
          <p className="text-xs text-muted-foreground/70">Not affiliated with any official university dining program. For students, by students.</p>
        </div>
      </footer>
    </div>
  )
}

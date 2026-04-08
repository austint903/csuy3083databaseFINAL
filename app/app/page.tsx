"use client"

import Link from "next/link"
import Image from "next/image"
import { motion, type Variants } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ShoppingCart, Tag, Shield, Zap, TrendingDown, Star } from "lucide-react"

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
    color: "bg-violet-50 text-violet-600",
  },
  {
    icon: Tag,
    title: "Sell Swipes",
    description: "Turn leftover swipes into cash before they expire.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Shield,
    title: "Verified Students",
    description: "Only verified university students can join and trade.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Zap,
    title: "Instant Matching",
    description: "Post a listing and get matched with buyers near your location.",
    color: "bg-amber-50 text-amber-600",
  },
]

const stats = [
  { value: "500+", label: "Active Students" },
  { value: "$3–7", label: "Avg Swipe Price" },
  { value: "1,200+", label: "Swipes Traded" },
  { value: "4.9★", label: "Avg Rating" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-10 h-16 border-b border-zinc-100 sticky top-0 z-50 bg-white/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#57068c] flex items-center justify-center">
            <span className="text-white text-sm font-black">S</span>
          </div>
          <span className="font-bold text-zinc-900 text-base">
            Swipe<span className="text-[#57068c]">Market</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/buy">
            <Button variant="ghost" size="sm">Browse</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="sm">Log In</Button>
          </Link>
          <Link href="/login">
            <Button size="sm" className="hidden sm:flex">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#57068c] via-[#40046a] to-[#2a0347] px-6 py-24 md:py-36">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Blobs */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 max-w-3xl mx-auto flex flex-col items-center text-center gap-7"
        >
          <motion.div variants={fadeUp}>
            <Badge variant="glass" className="text-xs px-3 py-1 gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              University Students Only
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight"
          >
            Trade Meal Swipes.
            <br />
            <span className="text-purple-200">Save Real Money.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-lg text-purple-200/80 max-w-lg leading-relaxed"
          >
            The peer-to-peer marketplace for university meal swipes. Buy cheap, sell extra — never let a swipe expire again.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3 justify-center">
            <Link href="/login">
              <Button size="lg" variant="white" className="gap-2 font-semibold shadow-lg shadow-black/20">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
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

      {/* Stats */}
      <section className="border-b border-zinc-100 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-zinc-100"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center px-4">
              <div className="text-3xl font-black text-[#57068c]">{s.value}</div>
              <div className="text-sm text-zinc-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-zinc-50">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="max-w-5xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-zinc-900">How it works</h2>
            <p className="text-zinc-500 mt-3 text-base max-w-md mx-auto">
              Simple, fast, and built for university students.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp}>
                <Card className="h-full border-zinc-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <CardContent className="p-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                      <f.icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-zinc-900 mb-2">{f.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{f.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* How it works steps */}
      <section className="py-24 px-6 bg-white">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="max-w-3xl mx-auto"
        >
          <motion.div variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-zinc-900">Three simple steps</h2>
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
                className="flex gap-5 items-start"
              >
                <div className="w-12 h-12 rounded-xl bg-[#57068c] text-white font-black text-sm flex items-center justify-center shrink-0">
                  {item.step}
                </div>
                <div className="pt-1">
                  <h3 className="font-bold text-zinc-900 mb-1">{item.title}</h3>
                  <p className="text-zinc-500 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-[#57068c] to-[#2a0347] py-20 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-lg mx-auto flex flex-col items-center gap-5"
        >
          <TrendingDown className="w-10 h-10 text-purple-300" />
          <h2 className="text-3xl md:text-4xl font-black text-white">Ready to start saving?</h2>
          <p className="text-purple-200 text-base">
            Join hundreds of students already trading swipes on campus.
          </p>
          <Link href="/login">
            <Button size="lg" variant="white" className="font-semibold gap-2 shadow-lg shadow-black/20">
              Log In with University SSO
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#57068c] flex items-center justify-center">
              <span className="text-white text-xs font-black">S</span>
            </div>
            <span className="text-zinc-500 text-sm font-medium">SwipeMarket</span>
          </div>
          <p className="text-xs text-zinc-400">Not affiliated with any official university dining program. For students, by students.</p>
        </div>
      </footer>
    </div>
  )
}

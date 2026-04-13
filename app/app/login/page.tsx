"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModeToggle } from "@/components/mode-toggle"
import { createClient } from "@/utils/supabase/client"
import {
  ArrowLeft, UtensilsCrossed, Loader2, AlertCircle,
  CheckCircle2, Eye, EyeOff, Mail, Lock
} from "lucide-react"

type Tab = "signin" | "signup"

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function validateDomain(email: string): Promise<boolean> {
    const supabase = createClient()
    const domain = email.split("@")[1]
    if (!domain) return false

    const { data } = await supabase.from("domain").select("email_domain")
    if (!data) return false

    // Handle both "@school.edu" and "school.edu" formats in the table
    return data.some((row) => {
      const stored = row.email_domain.replace(/^@/, "")
      return stored === domain
    })
  }

  async function handleSignIn() {
    setError("")
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push("/buy")
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp() {
    setError("")
    setLoading(true)
    try {
      const valid = await validateDomain(email)
      if (!valid) {
        throw new Error("Your email domain is not approved. Please use a valid university email.")
      }

      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      // Propagate into public.user immediately (trigger handles it too, but this ensures it)
      const netId = email.split("@")[0]
      if (data.user) {
        await supabase.from("user").upsert(
          { net_id: netId, first_name: "", last_name: "", phone_number: "" },
          { onConflict: "net_id", ignoreDuplicates: true }
        )
      }

      setSuccess("Account created! Check your email to confirm, then sign in.")
      setTab("signin")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tab === "signin") handleSignIn()
    else handleSignUp()
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-800 to-stone-800 px-6">
      <div className="absolute right-6 top-6 z-20">
        <ModeToggle className="text-white hover:bg-white/10 hover:text-white" />
      </div>
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="pointer-events-none absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-sky-300/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-48 h-[600px] w-[600px] rounded-full bg-amber-200/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Back */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-300 transition-colors hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="bg-white rounded-2xl shadow-2xl shadow-black/30 overflow-hidden"
        >
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-slate-700 via-slate-500 to-stone-500" />

          <div className="p-7 flex flex-col gap-5">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-slate-900/20">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-zinc-900 leading-none">
                  Swipe<span className="text-primary">Market</span>
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">University meal swipe marketplace</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex rounded-lg bg-zinc-100 p-1 gap-1">
              {(["signin", "signup"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(""); setSuccess("") }}
                  className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition-all duration-150 cursor-pointer ${
                    tab === t
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {t === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            {/* Success banner */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-sm text-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  University Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <Input
                    type="email"
                    placeholder="you@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={tab === "signup" ? "Min. 6 characters" : "Enter password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    required
                    minLength={tab === "signup" ? 6 : undefined}
                    autoComplete={tab === "signin" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-600"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 font-semibold mt-1 gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Please wait…</>
                ) : tab === "signin" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            {/* Domain hint */}
            {tab === "signup" && (
              <p className="text-xs text-zinc-400 text-center leading-relaxed">
                Only approved university domains are accepted
                <br />
                (e.g. nyu.edu, illinois.edu, umich.edu)
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

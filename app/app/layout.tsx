import "./globals.css"
import type { Metadata } from "next"
import { Providers } from "@/components/providers"
import { Header } from "@/components/Header"
import { NotificationProvider } from "@/components/NotificationProvider"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"

export const metadata: Metadata = {
  title: "Swipe Marketplace",
  description: "Campus meal swipe peer-to-peer marketplace",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  const netId = user?.email?.split("@")[0] ?? null

  let displayName: string | null = null
  if (netId) {
    const { data: profile } = await supabase
      .from("user")
      .select("first_name, last_name")
      .eq("net_id", netId)
      .single()
    if (profile) {
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ")
      if (name) displayName = name
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <NotificationProvider netId={netId}>
            <Header user={user} displayName={displayName} />
            {children}
          </NotificationProvider>
        </Providers>
      </body>
    </html>
  )
}


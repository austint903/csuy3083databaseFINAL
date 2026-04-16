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

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <NotificationProvider netId={netId}>
            <Header user={user} />
            {children}
          </NotificationProvider>
        </Providers>
      </body>
    </html>
  )
}


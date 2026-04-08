import "./globals.css"
import type { Metadata } from "next"
import { Providers } from "@/components/providers"
import { Header } from "@/components/Header"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"

export const metadata: Metadata = {
  title: "Swipe Marketplace",
  description: "NYU Meal Swipe Peer-to-Peer Marketplace",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <body className="bg-zinc-50 min-h-screen">
        <Providers>
          <Header user={user} />
          {children}
        </Providers>
      </body>
    </html>
  )
}

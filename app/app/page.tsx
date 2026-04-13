import { cookies } from "next/headers"
import { LandingPage } from "@/components/LandingPage"
import { createClient } from "@/utils/supabase/server"

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return <LandingPage isLoggedIn={Boolean(user)} />
}

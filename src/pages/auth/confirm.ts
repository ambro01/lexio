import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const INVALID_LINK = `/auth/forgot-password?error=${encodeURIComponent("This reset link is invalid or has expired. Request a new one.")}`;

export const GET: APIRoute = async (context) => {
  const tokenHash = context.url.searchParams.get("token_hash");
  const type = context.url.searchParams.get("type");

  if (!tokenHash || type !== "recovery") {
    return context.redirect(INVALID_LINK);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(INVALID_LINK);
  }
  // Session cookies are written by the server client's setAll, so the link works on any device.
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

  if (error) {
    return context.redirect(INVALID_LINK);
  }

  return context.redirect("/auth/update-password");
};

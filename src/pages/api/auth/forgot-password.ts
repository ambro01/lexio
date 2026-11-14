import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  // No redirectTo: the recovery email template builds the link from the Site URL.
  // No own user lookup: the response must not reveal whether the account exists.
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    return context.redirect(`/auth/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/auth/forgot-password?sent=1");
};

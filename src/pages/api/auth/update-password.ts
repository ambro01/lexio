import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/update-password?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect(
      `/auth/forgot-password?error=${encodeURIComponent("Your reset session has expired. Request a new link.")}`,
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return context.redirect(`/auth/update-password?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard?password_updated=1");
};

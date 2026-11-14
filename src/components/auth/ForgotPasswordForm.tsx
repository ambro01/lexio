import React, { useState } from "react";
import { Mail, Send } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

export default function ForgotPasswordForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();

  function validate() {
    let next: string | undefined;
    if (!email.trim()) {
      next = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next = "Enter a valid email address";
    }
    setError(next);
    return next === undefined;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/auth/forgot-password" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label="Email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          if (error) setError(undefined);
        }}
        placeholder="you@example.com"
        error={error}
        icon={<Mail className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Sending..." icon={<Send className="size-4" />}>
        Send reset link
      </SubmitButton>
    </form>
  );
}

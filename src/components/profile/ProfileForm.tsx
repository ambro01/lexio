import { useState } from "react";
import { Check, CircleAlert, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CEFR_LEVELS } from "@/lib/ai/proposals";
import { isRecord } from "@/lib/utils";
import type { AiModelId, CefrLevel, Profile } from "@/types";

interface Props {
  profile: Profile;
  models: readonly { id: AiModelId; label: string }[];
  defaultModelId: AiModelId;
}

type Status = { name: "idle" } | { name: "saving" } | { name: "saved" } | { name: "error"; message: string };

const NETWORK_ERROR = "Nie udało się połączyć z serwerem. Spróbuj ponownie.";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-400 focus:outline-none";
const optionClass = "bg-slate-900 text-white";
const primaryClass = "rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500";

function isProfile(body: unknown): body is Profile {
  return isRecord(body) && "cefrLevel" in body && "aiModel" in body;
}

async function postProfile(profile: Profile): Promise<{ ok: true; data: Profile } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }

  const serverError = `Błąd serwera (HTTP ${String(response.status)}). Spróbuj ponownie.`;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, message: serverError };
  }

  if (response.ok && isProfile(body)) {
    return { ok: true, data: body };
  }
  if (isRecord(body) && typeof body.message === "string") {
    return { ok: false, message: body.message };
  }
  return { ok: false, message: serverError };
}

export default function ProfileForm({ profile, models, defaultModelId }: Props) {
  const [cefrLevel, setCefrLevel] = useState<CefrLevel | null>(profile.cefrLevel);
  const [aiModel, setAiModel] = useState<AiModelId | null>(profile.aiModel);
  const [status, setStatus] = useState<Status>({ name: "idle" });

  const saving = status.name === "saving";
  const defaultLabel = models.find((model) => model.id === defaultModelId)?.label ?? defaultModelId;

  async function save() {
    setStatus({ name: "saving" });
    const result = await postProfile({ cefrLevel, aiModel });
    if (!result.ok) {
      setStatus({ name: "error", message: result.message });
      return;
    }
    setCefrLevel(result.data.cefrLevel);
    setAiModel(result.data.aiModel);
    setStatus({ name: "saved" });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="space-y-2">
        <label htmlFor="profile-level" className="block text-sm font-medium text-blue-100/80">
          Twój poziom angielskiego
        </label>
        <select
          id="profile-level"
          value={cefrLevel ?? ""}
          disabled={saving}
          onChange={(e) => {
            setCefrLevel(CEFR_LEVELS.find((level) => level === e.target.value) ?? null);
            setStatus({ name: "idle" });
          }}
          className={inputClass}
        >
          <option value="" className={optionClass}>
            Nie ustawiono
          </option>
          {CEFR_LEVELS.map((level) => (
            <option key={level} value={level} className={optionClass}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="profile-model" className="block text-sm font-medium text-blue-100/80">
          Model AI
        </label>
        <select
          id="profile-model"
          value={aiModel ?? ""}
          disabled={saving}
          onChange={(e) => {
            setAiModel(models.find((model) => model.id === e.target.value)?.id ?? null);
            setStatus({ name: "idle" });
          }}
          className={inputClass}
        >
          <option value="" className={optionClass}>
            Domyślny ({defaultLabel})
          </option>
          {models.map((model) => (
            <option key={model.id} value={model.id} className={optionClass}>
              {model.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={saving} className={primaryClass}>
          {saving ? (
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Save className="size-4" />
          )}
          Zapisz
        </Button>

        {status.name === "saved" && (
          <span className="flex items-center gap-2 text-sm text-green-300" role="status">
            <Check className="size-4" />
            Zapisano
          </span>
        )}
      </div>

      {status.name === "error" && (
        <div
          className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          <CircleAlert className="size-4 shrink-0" />
          <span className="flex-1">{status.message}</span>
        </div>
      )}
    </form>
  );
}

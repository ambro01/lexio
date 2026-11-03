import { useEffect, useRef, useState } from "react";
import { CircleAlert, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_INPUT_WORDS, countWords, type Proposal } from "@/lib/ai/proposals";
import type { GenerationUsage } from "@/lib/services/ai-generation.service";
import { cn } from "@/lib/utils";

interface ModelOption {
  id: string;
  label: string;
}

interface Props {
  models: readonly ModelOption[];
  defaultModelId: string;
}

interface GenerationMeta {
  model: string;
  durationMs: number;
  inputWords: number;
  dropped: number;
  usage: GenerationUsage;
}

interface GenerationSuccess {
  proposals: Proposal[];
  meta: GenerationMeta;
}

type GenerationState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; data: GenerationSuccess }
  | { status: "error"; message: string };

const GENERIC_ERROR = "Nie udało się połączyć z serwerem. Spróbuj ponownie.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGenerationSuccess(value: unknown): value is GenerationSuccess {
  return isRecord(value) && Array.isArray(value.proposals) && isRecord(value.meta);
}

async function requestProposals(text: string, model: string): Promise<GenerationState> {
  let response: Response;
  try {
    response = await fetch("/api/ai/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, model }),
    });
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  if (response.ok && isGenerationSuccess(body)) {
    return { status: "success", data: body };
  }
  if (isRecord(body) && typeof body.message === "string") {
    return { status: "error", message: body.message };
  }
  return { status: "error", message: GENERIC_ERROR };
}

function formatMeta(meta: GenerationMeta, proposalCount: number, models: readonly ModelOption[]): string {
  const modelLabel = models.find((model) => model.id === meta.model)?.label ?? meta.model;
  const parts = [
    `Model: ${modelLabel}`,
    `czas: ${(meta.durationMs / 1000).toFixed(1)} s`,
    `propozycje: ${String(proposalCount)}`,
    `odrzucone: ${String(meta.dropped)}`,
  ];
  const { promptTokens, completionTokens, costUsd } = meta.usage;
  if (promptTokens !== undefined || completionTokens !== undefined) {
    parts.push(`tokeny: ${String(promptTokens ?? "?")} wej. / ${String(completionTokens ?? "?")} wyj.`);
  }
  if (costUsd !== undefined) {
    parts.push(`koszt: $${costUsd.toFixed(5)}`);
  }
  return parts.join(" · ");
}

export default function GenerationSpike({ models, defaultModelId }: Props) {
  const [text, setText] = useState("");
  const [model, setModel] = useState(defaultModelId);
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const mounted = useRef(true);

  const words = countWords(text);
  const overLimit = words > MAX_INPUT_WORDS;
  const running = state.status === "running";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!running) {
      return;
    }
    const started = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [running]);

  async function generate() {
    setElapsedSeconds(0);
    setState({ status: "running" });
    const next = await requestProposals(text, model);
    if (mounted.current) {
      setState(next);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="lesson-text" className="block text-sm font-medium text-blue-100/80">
          Tekst lekcji
        </label>
        <textarea
          id="lesson-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          rows={10}
          placeholder="Wklej tekst lekcji po angielsku…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:border-purple-400 focus:outline-none"
        />
        <p className={cn("text-right text-xs", overLimit ? "text-red-300" : "text-blue-100/60")}>
          {words} / {MAX_INPUT_WORDS} słów
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <label htmlFor="model" className="block text-sm font-medium text-blue-100/80">
            Model
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
            }}
            disabled={running}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
          >
            {models.map((option) => (
              <option key={option.id} value={option.id} className="bg-slate-900">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          onClick={() => {
            void generate();
          }}
          disabled={running || overLimit || words === 0}
          className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
        >
          <Sparkles className="size-4" />
          Generuj
        </Button>

        {running && (
          <span className="flex items-center gap-2 text-sm text-blue-100/80" role="status">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Generuję… {elapsedSeconds} s
          </span>
        )}
      </div>

      {state.status === "error" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          <CircleAlert className="size-4 shrink-0" />
          <span className="flex-1">{state.message}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void generate();
            }}
            disabled={overLimit || words === 0}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <RotateCcw className="size-4" />
            Spróbuj ponownie
          </Button>
        </div>
      )}

      {state.status === "success" && (
        <div className="space-y-3">
          <p className="text-xs text-blue-100/60">{formatMeta(state.data.meta, state.data.proposals.length, models)}</p>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-blue-100/80">
                <tr>
                  <th className="px-3 py-2 font-medium">Słowo</th>
                  <th className="px-3 py-2 font-medium">Tłumaczenie</th>
                  <th className="px-3 py-2 font-medium">Inne znaczenia</th>
                  <th className="px-3 py-2 font-medium">Przykład</th>
                  <th className="px-3 py-2 font-medium">CEFR</th>
                </tr>
              </thead>
              <tbody>
                {state.data.proposals.map((proposal) => (
                  <tr key={proposal.word} className="border-t border-white/10 align-top">
                    <td className="px-3 py-2 font-semibold text-white">{proposal.word}</td>
                    <td className="px-3 py-2">{proposal.translation}</td>
                    <td className="px-3 py-2 text-blue-100/70">{proposal.additionalMeanings.join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-blue-100/70 italic">{proposal.exampleSentence}</td>
                    <td className="px-3 py-2">{proposal.cefr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

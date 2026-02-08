import { NextResponse } from "next/server";

type BriefRequest = {
  objective: string;
  audience?: string;
  tone?: string;
  cta?: string;
  constraints?: string;
};

type BriefResponse = {
  brief: string;
  deliverables: string[];
  do: string[];
  dont: string[];
  budgetNotes?: string;
};

function normalize(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

function deterministicTemplate(req: BriefRequest): BriefResponse {
  const objective = normalize(req.objective) || "Launch a campaign";
  const audience = normalize(req.audience) || "Base users";
  const tone = normalize(req.tone) || "clear, friendly, onchain-native";
  const cta = normalize(req.cta) || "Try it now";
  const constraints = normalize(req.constraints);

  const briefLines = [
    `Objective: ${objective}.`,
    `Audience: ${audience}.`,
    `Tone: ${tone}.`,
    `Primary CTA: ${cta}.`,
    constraints ? `Constraints: ${constraints}.` : null,
    "",
    "Message pillars:",
    `- Explain the value in one sentence (what, for whom, why now).`,
    `- Show proof: metrics, screenshots, onchain transparency, or testimonials.`,
    `- Make the next step frictionless: 1 link, 1 action.`,
  ].filter(Boolean);

  return {
    brief: briefLines.join("\n"),
    deliverables: [
      "1x campaign landing page copy (hero + benefits + FAQ)",
      "3x short posts (X / Farcaster) with variants",
      "1x announcement thread (5–7 tweets) or long-form post",
      "1x creative checklist (assets, sizes, links, tracking)",
    ],
    do: [
      "Lead with the outcome, not the feature",
      "Include a concrete proof point (number, demo, or onchain link)",
      "Use one clear CTA and one canonical link",
    ],
    dont: [
      "Don’t use vague claims without a proof point",
      "Don’t ship more than one primary CTA per post",
      "Don’t overpromise—keep scope demo-friendly",
    ],
    budgetNotes:
      "Budget guidance: allocate 70% to primary channel, 20% to amplification, 10% to experimentation. Keep tracking simple.",
  };
}

type LlmClient = {
  generateBrief: (req: BriefRequest) => Promise<BriefResponse>;
};

function parseJsonObjectContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("LLM did not return valid JSON");
    }
    return JSON.parse(content.slice(start, end + 1));
  }
}

function createLlmClient(): LlmClient | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;

  const provider = (process.env.LLM_PROVIDER ?? "openai-compatible").toLowerCase();
  const apiUrl = process.env.LLM_API_URL ?? "https://api.openai.com/v1/chat/completions";
  const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? "20000");

  if (provider !== "openai-compatible") {
    return null;
  }

  return {
    async generateBrief(req: BriefRequest) {
      const payload = {
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a polite campaign assistant. Suggest a brief and checklist. Output ONLY valid JSON with keys: brief (string), deliverables (string[]), do (string[]), dont (string[]), budgetNotes (string, optional). Keep it concise and practical.",
          },
          {
            role: "user",
            content: JSON.stringify(req),
          },
        ],
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          throw new Error(`LLM request timed out after ${timeoutMs}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const parsed = parseJsonObjectContent(content) as Partial<BriefResponse>;

      if (
        typeof parsed.brief !== "string" ||
        !Array.isArray(parsed.deliverables) ||
        !Array.isArray(parsed.do) ||
        !Array.isArray(parsed.dont)
      ) {
        throw new Error("LLM returned invalid shape");
      }

      const deliverables = parsed.deliverables.map((x) => String(x).trim()).filter(Boolean);
      const dos = parsed.do.map((x) => String(x).trim()).filter(Boolean);
      const donts = parsed.dont.map((x) => String(x).trim()).filter(Boolean);
      const brief = parsed.brief.trim();
      if (!brief || deliverables.length === 0 || dos.length === 0 || donts.length === 0) {
        throw new Error("LLM returned empty required fields");
      }

      return {
        brief,
        deliverables,
        do: dos,
        dont: donts,
        budgetNotes: parsed.budgetNotes ? String(parsed.budgetNotes) : undefined,
      };
    },
  };
}

export async function POST(req: Request) {
  const json = (await req.json().catch(() => null)) as Partial<BriefRequest> | null;
  const input: BriefRequest = {
    objective: normalize(json?.objective),
    audience: normalize(json?.audience),
    tone: normalize(json?.tone),
    cta: normalize(json?.cta),
    constraints: normalize(json?.constraints),
  };

  if (!input.objective) {
    return NextResponse.json({ error: "objective is required" }, { status: 400 });
  }

  const llm = createLlmClient();
  if (!llm) {
    return NextResponse.json(deterministicTemplate(input));
  }

  try {
    const out = await llm.generateBrief(input);
    return NextResponse.json(out);
  } catch (err) {
    const fallback = deterministicTemplate(input);
    return NextResponse.json(
      {
        ...fallback,
        budgetNotes:
          (fallback.budgetNotes ?? "") +
          (fallback.budgetNotes ? "\n\n" : "") +
          `Fallback mode used (LLM error: ${(err as Error).message}).`,
      },
      { status: 200 },
    );
  }
}

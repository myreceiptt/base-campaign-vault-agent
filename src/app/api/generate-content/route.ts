import { NextResponse } from "next/server";

type ContentRequest = {
    brief: string;
    deliverables: string[];
    objective: string;
    audience: string;
    tone: string;
    cta: string;
};

type GeneratedContent = {
    posts: Array<{
        platform: "twitter" | "farcaster" | "linkedin";
        content: string;
        variant?: string;
    }>;
    landingCopy: {
        headline: string;
        subheadline: string;
        bulletPoints: string[];
        ctaButton: string;
    };
    announcementThread: string[];
};

function normalize(input: unknown) {
    return typeof input === "string" ? input.trim() : "";
}

// Deterministic template when LLM is not available
function deterministicTemplate(req: ContentRequest): GeneratedContent {
    const objective = normalize(req.objective) || "Launch campaign";
    const audience = normalize(req.audience) || "Web3 users";
    const tone = normalize(req.tone) || "professional";
    const cta = normalize(req.cta) || "Try it now";

    return {
        posts: [
            {
                platform: "twitter",
                content: `🚀 ${objective}\n\nBuilt for ${audience}.\n\n${cta} 👇`,
                variant: "announcement",
            },
            {
                platform: "twitter",
                content: `Why ${audience} should care:\n\n✅ Transparent onchain payments\n✅ AI-powered briefs\n✅ Trustless escrow\n\n${cta}`,
                variant: "benefits",
            },
            {
                platform: "twitter",
                content: `The problem: Campaign payments are opaque and slow.\n\nThe solution: Onchain escrow with AI-generated briefs.\n\n${cta}`,
                variant: "problem-solution",
            },
            {
                platform: "farcaster",
                content: `gm!\n\n${objective}\n\nBuilding in public on @base. ${cta} /link`,
            },
            {
                platform: "linkedin",
                content: `Excited to announce: ${objective}\n\nWe're leveraging blockchain technology to bring transparency to campaign management.\n\nKey features:\n• Smart contract escrow\n• AI-generated campaign briefs\n• Trustless fund release\n\n${cta}`,
            },
        ],
        landingCopy: {
            headline: objective,
            subheadline: `The ${tone} way to manage campaigns for ${audience}`,
            bulletPoints: [
                "✅ AI generates your campaign brief in seconds",
                "✅ USDC escrow secured by smart contracts",
                "✅ Transparent, verifiable, onchain",
                "✅ Release funds only when deliverables are met",
            ],
            ctaButton: cta,
        },
        announcementThread: [
            `1/ 🧵 Introducing a new way to run campaigns\n\n${objective}`,
            `2/ The problem: Traditional campaign payments are:\n\n❌ Opaque\n❌ Slow\n❌ Trust-dependent\n\nThere's a better way.`,
            `3/ Our solution:\n\n✅ AI-powered brief generation\n✅ Onchain USDC escrow\n✅ Trustless fund release\n✅ Full transparency`,
            `4/ How it works:\n\n1️⃣ Create campaign & generate AI brief\n2️⃣ Deposit USDC to escrow\n3️⃣ Publisher delivers work\n4️⃣ Release funds or refund`,
            `5/ Built for ${audience} who value:\n\n• Transparency\n• Speed\n• Security`,
            `6/ ${cta}\n\n🔗 [link]\n\nBuilt on @base with ❤️`,
        ],
    };
}

type LlmClient = {
    generateContent: (req: ContentRequest) => Promise<GeneratedContent>;
};

function createLlmClient(): LlmClient | null {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) return null;

    const provider = (process.env.LLM_PROVIDER ?? "openai-compatible").toLowerCase();
    const apiUrl = process.env.LLM_API_URL ?? "https://api.openai.com/v1/chat/completions";
    const model = process.env.LLM_MODEL ?? "gpt-4o-mini";

    if (provider !== "openai-compatible") {
        return null;
    }

    return {
        async generateContent(req: ContentRequest) {
            const systemPrompt = `You are a marketing content generator for Web3 campaigns. Generate engaging social media posts and landing page copy.

Output ONLY valid JSON with this exact structure:
{
  "posts": [
    {"platform": "twitter", "content": "...", "variant": "announcement"},
    {"platform": "twitter", "content": "...", "variant": "benefits"},
    {"platform": "twitter", "content": "...", "variant": "problem-solution"},
    {"platform": "farcaster", "content": "..."},
    {"platform": "linkedin", "content": "..."}
  ],
  "landingCopy": {
    "headline": "...",
    "subheadline": "...",
    "bulletPoints": ["...", "...", "...", "..."],
    "ctaButton": "..."
  },
  "announcementThread": ["1/ ...", "2/ ...", "3/ ...", "4/ ...", "5/ ...", "6/ ..."]
}

Keep posts concise. Twitter max 280 chars. Use emojis appropriately. Match the tone specified.`;

            const userPrompt = `Generate content for this campaign:

Brief: ${req.brief}

Objective: ${req.objective}
Audience: ${req.audience}
Tone: ${req.tone}
CTA: ${req.cta}
Deliverables: ${req.deliverables.join(", ")}`;

            const payload = {
                model,
                temperature: 0.7,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
            };

            const res = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 300)}`);
            }

            const data = (await res.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };
            const content = data.choices?.[0]?.message?.content ?? "";
            const parsed = JSON.parse(content) as Partial<GeneratedContent>;

            // Validate structure
            if (!Array.isArray(parsed.posts) || !parsed.landingCopy || !Array.isArray(parsed.announcementThread)) {
                throw new Error("LLM returned invalid shape");
            }

            return parsed as GeneratedContent;
        },
    };
}

export async function POST(req: Request) {
    const json = (await req.json().catch(() => null)) as Partial<ContentRequest> | null;

    const input: ContentRequest = {
        brief: normalize(json?.brief),
        deliverables: Array.isArray(json?.deliverables) ? json.deliverables.map(String) : [],
        objective: normalize(json?.objective),
        audience: normalize(json?.audience),
        tone: normalize(json?.tone),
        cta: normalize(json?.cta),
    };

    if (!input.brief && !input.objective) {
        return NextResponse.json({ error: "brief or objective is required" }, { status: 400 });
    }

    const llm = createLlmClient();
    if (!llm) {
        // No LLM configured, use deterministic template
        return NextResponse.json(deterministicTemplate(input));
    }

    try {
        const out = await llm.generateContent(input);
        return NextResponse.json(out);
    } catch (err) {
        // Fallback to template on error
        const fallback = deterministicTemplate(input);
        return NextResponse.json(fallback, { status: 200 });
    }
}

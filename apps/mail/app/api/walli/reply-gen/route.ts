import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface TalentRate {
  channel: string;
  deliverable: string;
  currency: string;
  rate: number;
}

interface TalentContext {
  talentName: string;
  bio?: string | null;
  rates: TalentRate[];
}

async function fetchTalentContextForEmail(
  email: string,
  supabase: SupabaseServerClient
): Promise<TalentContext | null> {
  if (!email) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('id, user_platform:user_platform_id(code)')
    .eq('email', email)
    .maybeSingle();

  if (!userData) return null;

  const userPlatform = userData.user_platform;
  const platformCode = Array.isArray(userPlatform)
    ? userPlatform[0]?.code
    : (userPlatform as { code: string } | null)?.code;
  if (platformCode !== 'talent') return null;

  const { data: talent } = await supabase
    .from('talent')
    .select('id, first_name, last_name, bio_short')
    .eq('user_id', userData.id)
    .maybeSingle();

  if (!talent) return null;

  const { data: rates } = await supabase
    .from('talent_rates')
    .select('channel, deliverable, currency, rate')
    .eq('talent_id', talent.id);

  const talentName =
    [talent.first_name, talent.last_name].filter(Boolean).join(' ') || 'the talent';

  return {
    talentName,
    bio: talent.bio_short,
    rates: (rates ?? []) as TalentRate[],
  };
}

/**
 * Given an internal email_threads UUID, find out if the first message was sent
 * to a "talent" platform user. If so, return that talent's name, bio, and rates
 * so the AI can reference them when the email is asking about pricing.
 */
async function fetchTalentContextForThread(
  threadId: string,
  supabase: SupabaseServerClient
): Promise<TalentContext | null> {
  // 1. Get the earliest message in the thread
  const { data: firstMessage } = await supabase
    .from('email_messages')
    .select('id')
    .eq('thread_id', threadId)
    .order('received_at', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!firstMessage) return null;

  // 2. Get all "to", "cc", and "bcc" recipients for that message
  const { data: recipients } = await supabase
    .from('email_message_recipients')
    .select('email, recipient_type')
    .eq('message_id', firstMessage.id)
    .in('recipient_type', ['to', 'cc', 'bcc']);

  if (!recipients || recipients.length === 0) return null;

  const isUndisclosed = (email: string | null) =>
    !email || email.toLowerCase().startsWith('undisclosed-recipients');

  // 3. Prefer a valid "to" recipient that is a talent
  const toEmails = recipients
    .filter((r) => r.recipient_type === 'to' && !isUndisclosed(r.email))
    .map((r) => r.email as string);

  for (const email of toEmails) {
    const ctx = await fetchTalentContextForEmail(email, supabase);
    if (ctx) return ctx;
  }

  // 4. If no matching "to" talent, fall back to bcc and cc
  const orderedTypes: Array<'bcc' | 'cc'> = ['bcc', 'cc'];

  for (const type of orderedTypes) {
    const emails = recipients
      .filter((r) => r.recipient_type === type && !isUndisclosed(r.email))
      .map((r) => r.email as string);

    for (const email of emails) {
      const ctx = await fetchTalentContextForEmail(email, supabase);
      if (ctx) return ctx;
    }
  }

  return null;
}

function formatTalentContext(ctx: TalentContext): string {
  const lines: string[] = [`Talent: ${ctx.talentName}`];
  if (ctx.bio) lines.push(`Bio: ${ctx.bio}`);
  if (ctx.rates.length > 0) {
    lines.push('Rates:');
    for (const r of ctx.rates) {
      const amount = Number(r.rate).toLocaleString('en-US');
      lines.push(`  - ${r.channel} / ${r.deliverable}: ${r.currency} ${amount}`);
    }
  } else {
    lines.push('Rates: Not on file');
  }
  return lines.join('\n');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const perplexityOpenAI = process.env.PERPLEXITY_API_KEY
  ? new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    })
  : null;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function getModelProvider(model: string): 'openai' | 'anthropic' | 'perplexity' {
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('sonar')) return 'perplexity';
  return 'openai';
}

async function runCompletion(
  model: string,
  systemMessage: string,
  userMessage: string
): Promise<string> {
  const provider = getModelProvider(model);

  if (provider === 'anthropic' && anthropic) {
    const message = await anthropic.messages.create({
      model: model as Parameters<typeof anthropic.messages.create>[0]['model'],
      max_tokens: 1024,
      temperature: 0.7,
      system: systemMessage,
      messages: [{ role: 'user', content: userMessage }],
    });
    return message.content[0].type === 'text' ? message.content[0].text : '';
  }

  if (provider === 'perplexity' && perplexityOpenAI) {
    const completion = await perplexityOpenAI.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });
    return completion.choices[0]?.message?.content?.trim() ?? '';
  }

  const modelToUse = model.startsWith('gpt-') ? model : 'gpt-4o';
  const completion = await openai.chat.completions.create({
    model: modelToUse,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

const ANTHROPIC_ALIASES: Record<string, string> = {
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
  'claude-3-5-sonnet-latest': 'claude-sonnet-4-6',
  'claude-3-opus-20240229': 'claude-opus-4-6',
  'claude-3-opus-latest': 'claude-opus-4-6',
};

/**
 * POST /api/walli/reply-gen
 * Generates a reply body for an email thread. Expects the client to send
 * threadContext (formatted string of the last N messages in the thread) and
 * replyTo (to, subject). Optional: optionalAngle, model.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      threadContext,
      replyTo,
      optionalAngle = '',
      model: requestedModel = 'gpt-4o',
      threadId,
    } = body;

    if (!threadContext || typeof threadContext !== 'string' || !threadContext.trim()) {
      return NextResponse.json(
        { error: 'threadContext is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const to = replyTo?.to ?? '';
    const subject = replyTo?.subject ?? '';

    const model = (ANTHROPIC_ALIASES[requestedModel] ?? requestedModel) || 'gpt-4o';

    // Attempt to fetch talent context if a thread ID was provided
    let talentCtx: TalentContext | null = null;
    if (threadId && typeof threadId === 'string') {
      try {
        talentCtx = await fetchTalentContextForThread(threadId, supabase);
      } catch (e) {
        // Non-fatal: proceed without talent context
        console.warn('[reply-gen] Could not fetch talent context:', e);
      }
    }

    const talentSection = talentCtx
      ? `\n\nTalent information (this email is addressed to our talent - reply on their behalf):\n${formatTalentContext(talentCtx)}\n\nIf the email is asking about rates, pricing, or deliverables: include ONLY the rates that match the deliverables or platforms explicitly requested in the incoming email (e.g. if they asked for "1 video" on YouTube and Instagram, only quote YouTube and Instagram rates that fit that ask—do not list every rate the talent has). The listed rates are base fees for content creation; usage-rights adjustments are described in the system rules below.`
      : '';

    const systemMessage = `You are writing a short, professional reply email that continues an existing thread. Use the thread context below to match tone and reference the right points. Write only the reply body—no subject line, no "Re:" prefix in the body.

Rules:
- Output only the email body in HTML with <div> tags (and <div>&nbsp;</div> for spacing) for Gmail.
- Do NOT include a subject line or "SUBJECT LINE:"—only the HTML body.
- Keep the reply concise and on-topic. Do not repeat long quotes from the thread.
- Do NOT use em dashes (—); use commas or hyphens instead.
- Be professional and factual; avoid hype words.
- In your opening sentence, thank the sender only once (for example, "Thanks for reaching out and for considering Caleb for this campaign"); avoid repeating "thanks" multiple times in the same sentence.
- Do NOT include the sender's name or an email signature (e.g. no sign-off with name, title, or contact block)—the sender will add their signature via the signature button. You may end with a brief closing like "All the best," or "Best," only.
- Do not ask the sender to repeat or clarify information that is already clearly stated in the thread (such as platforms, deliverable count, or links).
- If the email lists specific platforms and deliverables (for example, "Platforms: YouTube, Instagram, TikTok; Deliverables: 1 video"), treat that as known context. Provide the relevant rates and, at most, invite them to let you know which option they prefer, instead of asking which platform or format they have in mind.${talentCtx ? `
- Treat the talent rates provided as base fees for content creation only.
- When replying with pricing and usage is mentioned, always separate (1) the base content-creation fees and (2) a clearly labeled usage fee, instead of baking usage into the individual base rates.
- If the sender explicitly mentions non-paid / organic usage (for example, organic posting on brand or partner channels without paid ads, or "organic usage"), first list the relevant base rate(s) unchanged. Then add a concise organic-usage line (for example: "Organic usage (1 month): USD X"), calculated at +20% per month on top of the applicable base fee(s). Do not include multi-line worked examples in the email body.
- If the sender explicitly mentions paid usage or running ads (for example, ad code validity, whitelisting, paid social, using the content in paid campaigns, or similar language), treat this as paid usage. First list the relevant base rate(s) unchanged. Then add a single concise paid-usage line (for example: "Paid usage (30 days, for the deliverables above): USD X"), where X is the combined total equal to 135% of the sum of the applicable base fee(s) (i.e. base rates plus 35%). Do not list separate paid-usage amounts per platform, do not include multi-line worked examples in the email body, do not say you will calculate the exact total later, and do not modify the base-rate numbers themselves.
- When a specific usage window is mentioned in days (for example, "Ad Code Validity: 30 days"), interpret 30 days as approximately one month of usage when applying the percentage adjustment.
- If usage rights (organic or paid) are not mentioned at all, quote the base rates as-is and do not bring up that usage would cost extra unless the client raises it first.
- When replying with rates, include a brief sentence thanking the sender for considering ${talentCtx.talentName} for the partnership or campaign (for example: "Thanks again for considering ${talentCtx.talentName} for this opportunity.").
- When referencing rates: quote only the talent rates that correspond to the deliverables or platforms requested in the email (e.g. YouTube pre-roll, Instagram Reel, TikTok, "1 video"). Do NOT list all available rates—only those that match what was asked for. Quote amounts accurately; do not invent or estimate.` : ''}`;

    const userMessage = `Thread context (most recent messages in chronological order):
${threadContext.trim()}
${talentSection}
---
Reply to: ${to}
Subject of the thread: ${subject}
${optionalAngle ? `Optional angle or focus for this reply: ${optionalAngle.trim()}` : ''}

Write the reply body only (HTML with <div> tags).`;

    const responseText = await runCompletion(model, systemMessage, userMessage);
    let content = (responseText ?? '').trim();
    if (!content) {
      return NextResponse.json(
        { error: 'Model returned empty content' },
        { status: 500 }
      );
    }
    if (!content.startsWith('<div>')) content = `<div>${content}</div>`;
    content = content
      .replace(/<p>/g, '<div>')
      .replace(/<\/p>/g, '</div>')
      .replace(/<div><br><\/div>/gi, '<div>&nbsp;</div>')
      .replace(/\s{2,}/g, ' ')
      .replace(/—/g, ' - ');

    return NextResponse.json({ content });
  } catch (error) {
    console.error('[reply-gen] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate reply' },
      { status: 500 }
    );
  }
}

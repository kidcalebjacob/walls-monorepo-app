import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

/** Serper organic result shape (for company search). */
interface SerperOrganicItem {
  title?: string;
  link?: string;
  snippet?: string;
}

/** Call Serper search API. Returns organic results or empty array on error. */
async function serperSearch(query: string, num: number = 4): Promise<SerperOrganicItem[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { organic?: SerperOrganicItem[] };
    return Array.isArray(data.organic) ? data.organic.filter((r) => r.link) : [];
  } catch {
    return [];
  }
}

/** Company shape for search-query generation. */
interface CompanyForSearch {
  name?: string | null;
  overview?: string | null;
  industry?: string | null;
}

/**
 * Use AI to generate 3 search queries tailored to company + talent + optional focus (e.g. new product),
 * then run Serper and return a context block for the email prompt.
 */
async function fetchCompanySearchContextWithAIQueries(
  company: CompanyForSearch,
  talentContext: TalentContextItem[],
  additionalContext: string,
  model: string
): Promise<string> {
  const companyName = (company?.name ?? '').trim();
  if (!companyName) return '';

  const talentSummary =
    talentContext.length === 0
      ? 'None specified.'
      : talentContext
          .map((t) => {
            const name = t.name || 'Unknown';
            const category = t.category ? ` (${t.category})` : '';
            const bio = t.bio_short ? ` — ${t.bio_short.slice(0, 120)}…` : '';
            return `${name}${category}${bio}`;
          })
          .join('\n');

  const systemQuery =
    'You suggest web search queries to find information that would help pitch a talent to a brand (e.g. recent products, campaigns, launches, or news that could align the talent with the brand). Output exactly 3 search queries, one per line. No numbering, no explanation, no quotes—just the raw query text, one per line. Do NOT use any specific year (e.g. 2023, 2024) in the queries—use the word "recent" instead (e.g. "recent launch", "recent campaign") since you do not have access to the current date.';

  const userQuery = `Company: ${companyName}${company?.industry ? ` (industry: ${company.industry})` : ''}${company?.overview ? `. Overview: ${company.overview}` : ''}

Talent we're pitching:
${talentSummary}

Additional focus from the sender (e.g. new product, specific product to promote, campaign type): ${(additionalContext ?? '').trim() || 'None.'}

Suggest 3 search queries that would best find aligning products, campaigns, or recent news for this talent–brand partnership.`;

  const responseText = await runCompletion(model, systemQuery, userQuery);
  const queries = responseText
    .trim()
    .split(/\n+/)
    .map((s) => s.replace(/^[\d.)\-\s]+/, '').trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);

  if (queries.length === 0) return '';

  console.log('[email-gen] AI-generated Serper search queries:', queries);

  const seen = new Set<string>();
  const items: { title: string; snippet: string }[] = [];
  for (const q of queries) {
    const results = await serperSearch(q, 3);
    for (const r of results) {
      if (!r.link || seen.has(r.link)) continue;
      seen.add(r.link);
      const title = (r.title || '').trim();
      const snippet = (r.snippet || '').trim();
      if (title || snippet) items.push({ title: title || '(no title)', snippet });
    }
  }
  if (items.length === 0) return '';
  const lines = items.map((i) => `- ${i.title}${i.snippet ? ` — ${i.snippet}` : ''}`);
  return [
    'Optional context: recent company activity or product news (from web search).',
    'Use this only if there is a clear, natural alignment with the talent—e.g. a campaign or product that fits the creator. Do NOT force a mention; if there is no strong fit, ignore this block and pitch on talent–brand fit in general. Use as extra fuel to deepen affinity when it genuinely applies.',
    '',
    lines.join('\n'),
  ].join('\n');
}

/** Talent rate row (from client, same shape as Wallie mentions). */
interface TalentRatePayload {
  channel: string;
  deliverable: string;
  currency: string;
  rate: number;
}

/** Talent context item (tagged talent in pitch tracker, sent in request body). */
interface TalentContextItem {
  type: 'talent';
  id: string;
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  bio_short?: string | null;
  category?: string | null;
  slug?: string | null;
  rates?: TalentRatePayload[];
}

/** Build a context string from tagged talent for the system prompt (disclose talent we are pitching). */
function buildTalentContextString(talentContext: TalentContextItem[]): string {
  if (!talentContext || talentContext.length === 0) return '';

  const parts: string[] = ['Context about the talent we are pitching (tagged in the email):'];

  for (const t of talentContext) {
    if (t.type !== 'talent') continue;
    const lines: string[] = [`- Talent: ${t.name || 'Unknown'}`];
    if (t.first_name != null) lines.push(`  First name: ${t.first_name}`);
    if (t.last_name != null) lines.push(`  Last name: ${t.last_name}`);
    if (t.country) lines.push(`  Country: ${t.country}`);
    if (t.category) lines.push(`  Category: ${t.category}`);
    if (t.bio_short) lines.push(`  Short bio: ${t.bio_short}`);
    const slug = t.slug?.trim();
    if (slug) {
      lines.push(`  Media kit URL: https://www.wallsentertainment.com/mediakit/${slug}`);
    }
    if (t.rates && t.rates.length > 0) {
      lines.push('  Rates:');
      for (const r of t.rates) {
        lines.push(`    - ${r.channel} / ${r.deliverable}: ${r.currency} ${r.rate}`);
      }
    }
    parts.push(lines.join('\n'));
  }

  return parts.join('\n\n');
}

/** Recipient (person) + company context for personalizing outreach (from people + companies tables). */
interface RecipientContext {
  person: {
    first_name?: string | null;
    last_name?: string | null;
    title?: string | null;
    is_contact: boolean;
  };
  company: {
    name?: string | null;
    overview?: string | null;
    industry?: string | null;
  } | null;
}

/** Fetch recipient context by email: person (title, is_contact, name) and linked company. */
async function fetchRecipientContext(recipientEmail: string): Promise<RecipientContext | null> {
  if (!recipientEmail || typeof recipientEmail !== 'string') return null;
  const email = recipientEmail.trim().toLowerCase();
  if (!email) return null;

  try {
    const supabase = await createClient();
    const { data: personRow, error: personError } = await supabase
      .from('people')
      .select('id, first_name, last_name, title, is_contact, company_id')
      .eq('email', email)
      .maybeSingle();

    if (personError || !personRow) return null;

    const is_contact = personRow.is_contact === true;
    const person = {
      first_name: personRow.first_name ?? null,
      last_name: personRow.last_name ?? null,
      title: personRow.title ?? null,
      is_contact,
    };

    let company: RecipientContext['company'] = null;
    if (personRow.company_id) {
      const { data: companyRow, error: companyError } = await supabase
        .from('companies')
        .select('name, overview, industry')
        .eq('id', personRow.company_id)
        .maybeSingle();
      if (!companyError && companyRow) {
        company = {
          name: companyRow.name ?? null,
          overview: companyRow.overview ?? null,
          industry: companyRow.industry ?? null,
        };
      }
    }

    return { person, company };
  } catch (err) {
    console.error('[email-gen] Error fetching recipient context:', err);
    return null;
  }
}

/** Build prompt block for recipient context (tone: contact vs cold, title-aware). */
function buildRecipientContextString(ctx: RecipientContext | null): string {
  if (!ctx) return '';

  const lines: string[] = ['Context about the recipient (person we are emailing):'];
  const { person, company } = ctx;
  lines.push(`- Is existing contact: ${person.is_contact ? 'Yes' : 'No'}`);
  if (person.title) lines.push(`- Title: ${person.title}`);
  if (person.first_name) lines.push(`- First name: ${person.first_name}`);
  if (person.last_name) lines.push(`- Last name: ${person.last_name}`);
  if (company?.name) lines.push(`- Company: ${company.name}`);
  if (company?.overview) lines.push(`- Company overview: ${company.overview}`);
  if (company?.industry) lines.push(`- Industry: ${company.industry}`);

  lines.push('');
  lines.push('Tone guidelines:');
  if (person.is_contact) {
    lines.push('- They are an existing contact. You may use a warmer, familiar tone (e.g. "I hope you\'ve been well").');
  } else {
    lines.push('- They are NOT an existing contact. Do NOT use phrases like "I hope you\'ve been well," "hope all is well," or any opener that implies a prior relationship. Use a professional, first-time-outreach tone only.');
  }
  if (person.title) {
    const t = person.title.toLowerCase();
    if (t.includes('ceo') || t.includes('chief') || t.includes('founder') || t.includes('president') || t.includes('head of')) {
      lines.push(`- They have a senior role (${person.title}). If this is cold outreach, consider adding a brief line acknowledging their time (e.g. "I understand being ${person.title} at ${company?.name || 'your company'} keeps you busy").`);
    }
  }
  return lines.join('\n');
}

/** Run a single completion with the given model; returns the response text. */
async function runCompletion(
  model: string,
  systemMessage: string,
  userMessage: string
): Promise<string> {
  const provider = getModelProvider(model);

  if (provider === 'anthropic' && anthropic) {
    const message = await anthropic.messages.create({
      model: model as any,
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

  // OpenAI (default)
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      personalInfo,
      recipientName,
      recipientEmail,
      model: requestedModel = 'gpt-4o',
      talentContext: rawTalentContext,
      followUpMode,
      firstEmailContent: rawFirstEmailContent,
    } = body;

    // Follow-up mode: write a brief follow-up to the first email (no talent pitch)
    if (followUpMode === true && typeof rawFirstEmailContent === 'string' && rawFirstEmailContent.trim()) {
      const ANTHROPIC_ALIASES: Record<string, string> = {
        'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
        'claude-3-5-sonnet-latest': 'claude-sonnet-4-6',
        'claude-3-opus-20240229': 'claude-opus-4-6',
        'claude-3-opus-latest': 'claude-opus-4-6',
      };
      const requested = typeof requestedModel === 'string' ? requestedModel : 'gpt-4o';
      const model = (ANTHROPIC_ALIASES[requested] ?? requested) || 'gpt-4o';
      const firstEmailContent = rawFirstEmailContent.trim();
      const followUpAngle = (typeof personalInfo === 'string' ? personalInfo : '').trim();

      const systemMessage = `You are writing a brief, concise follow-up email. The recipient already received the email below. Your task is to write a short follow-up that references or builds on it without repeating the original. Keep it professional and to the point. Do not reintroduce the talent or the ask—just a nudge, reminder, or add-on. Avoid hype words (e.g. "amazing," "perfectly"). Use factual, professional tone. Do NOT use em dashes (—); use commas or hyphens. Output only the email body in HTML with <div> tags (and <div>&nbsp;</div> for spacing) for Gmail. Do NOT include a subject line or "SUBJECT LINE:"—only the HTML body.`;

      const userMessage = `First email they received:
${firstEmailContent}
${followUpAngle ? `\nOptional angle/focus for this follow-up: ${followUpAngle}\n` : ''}
Write a brief, concise follow-up (HTML body only, no subject).`;

      const responseText = await runCompletion(model, systemMessage, userMessage);
      let content = responseText.trim();
      if (!content.startsWith('<div>')) content = `<div>${content}</div>`;
      content = content
        .replace(/<p>/g, '<div>')
        .replace(/<\/p>/g, '</div>')
        .replace(/<div><br><\/div>/gi, '<div>&nbsp;</div>')
        .replace(/\s{2,}/g, ' ')
        .replace(/—/g, ' - ');
      return NextResponse.json({ content, subject: '' });
    }

    // Map deprecated Anthropic 3.x model IDs to current 4.x so older clients still work
    const ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
      'claude-3-5-sonnet-latest': 'claude-sonnet-4-6',
      'claude-3-opus-20240229': 'claude-opus-4-6',
      'claude-3-opus-latest': 'claude-opus-4-6',
    };
    const requested = typeof requestedModel === 'string' ? requestedModel : 'gpt-4o';
    const model = (ANTHROPIC_MODEL_ALIASES[requested] ?? requested) || 'gpt-4o';
    const talentContext: TalentContextItem[] = Array.isArray(rawTalentContext)
      ? rawTalentContext.filter((t: unknown) => t && typeof t === 'object' && (t as TalentContextItem).type === 'talent')
      : [];

    if (talentContext.length > 0) {
      console.log('[email-gen] Talent context being sent to AI:', JSON.stringify(talentContext, null, 2));
    }

    const recipientContext = typeof recipientEmail === 'string'
      ? await fetchRecipientContext(recipientEmail)
      : null;
    if (recipientContext) {
      console.log('[email-gen] Recipient context being sent to AI:', JSON.stringify(recipientContext, null, 2));
    }

    // Prefer recipient first name from fetched context; fallback to recipientName (never use "there")
    const recipientFirstName =
      (recipientContext?.person?.first_name?.trim()) ||
      (typeof recipientName === 'string' && recipientName.trim().toLowerCase() !== 'there'
        ? recipientName.trim().split(/\s+/)[0]
        : null);

    let companySearchBlock = '';
    if (recipientContext?.company?.name && process.env.SERPER_API_KEY) {
      companySearchBlock = await fetchCompanySearchContextWithAIQueries(
        recipientContext.company,
        talentContext,
        typeof personalInfo === 'string' ? personalInfo : '',
        model
      );
      if (companySearchBlock) {
        console.log('[email-gen] Company search context (Serper – recent news/activity) for:', recipientContext.company.name);
        console.log('[email-gen] Serper data being sent to AI:', companySearchBlock);
      }
    }

    const recipientContextBlock = buildRecipientContextString(recipientContext);
    const talentContextBlock = buildTalentContextString(talentContext);
    const systemPrefix = [recipientContextBlock, talentContextBlock, companySearchBlock]
      .filter(Boolean)
      .join('\n\n');
    const systemMessage =
      (systemPrefix ? systemPrefix + '\n\n' : '') +
      `You are a talent agent writing a short outreach email. The goal is to pitch the TALENT (from the context above) to the RECIPIENT (brand/contact) as concisely and professionally as possible.

Do the following:
- GREETING (required): You MUST open the email with "Hi [recipient first name]," using the exact first name provided for the recipient. NEVER use "Hi there," "Hello," "Hey there," or any greeting without the recipient's first name. If a first name is provided below, your first line must start with "Hi [that exact name],". NEVER start with "Dear"—always use "Hi". If the recipient context says "Is existing contact: No", do NOT use "I hope you've been well" or similar—that is only for existing contacts. Position the opener as reaching out on behalf of the talent (e.g. "Reaching out on behalf of [Talent Name]..." or "I'm reaching out on behalf of [Talent Name]...") rather than generic "I'm reaching out to introduce" or "reaching out to connect." Follow the tone guidelines in the recipient context above (contact vs cold, senior role acknowledgment if relevant).
- Pitch the talent: who they are and why they make sense for this brand/opportunity. Draw a clear line between the talent and the recipient—why this talent fits. Use the talent context (bio, category, rates if relevant) and any creator content/achievement provided. Be specific, not generic.
- Do NOT state that you or we "represent" the talent in the closing or elsewhere—it is already clear from reaching out on their behalf. Do NOT write paragraphs about "we pride ourselves," "we handle everything from," "we've had the pleasure of working with brands," or similar agency boilerplate.
- Suggest a next step: you can offer a call if they'd like, but also leave the door open to keep the conversation going here in email (e.g. "Happy to jump on a call if useful."). Do not make a call feel required. If a talent has a "Media kit URL" listed in the talent context above, include in your closing paragraph a short line like "For more information, feel free to view [Talent Name]'s Media Kit." Hyperlink that phrase (e.g. "[Talent Name]'s Media Kit" or "[Talent Name] Media Kit") using the exact URL provided—use an HTML anchor: <a href="[URL]">[Talent Name]'s Media Kit</a>. Do NOT paste the URL as plain text; always use the hyperlink. If multiple talents have media kit URLs, link each name's "Media Kit" text to its respective URL. You may end with a brief closing like "All the best," or "Best," but do NOT include the sender's name or a signature placeholder (e.g. no [Your name], [First name], or [Signature])—the sender will add their signature via the signature button.

Be concise. Short paragraphs. No filler. Avoid hype words and superlatives (e.g. "perfectly," "amazing," "incredible," "perfect fit")—keep the tone factual, to the point, and professional; people trust that more. Do NOT use em dashes (—); use commas, periods, or regular hyphens instead. Subject line must be under 50 characters. Start your response with "SUBJECT LINE:" then the subject on its own line, then two newlines, then the email body in HTML with <div> tags (and <div>&nbsp;</div> for spacing) for Gmail.`;

    const userMessage = `Creator content/achievement to weave in if provided: "${personalInfo || '(none)'}"

Recipient first name for greeting (you MUST use this—open with "Hi [this name],") : ${recipientFirstName ?? '(none provided—use a single-word placeholder like "Hi,")'}

Write the email. Start with "SUBJECT LINE:" then the subject, then two newlines, then the HTML body with <div> tags. Your first line of the body must be "Hi [recipient first name],".`;

    const responseText = await runCompletion(model, systemMessage, userMessage);

    const parts = responseText.split('\n\n');
    const subject = parts[0].replace(/^SUBJECT LINE:\s*/i, '').trim() || (recipientFirstName ? `${recipientFirstName} x WALLS | Connect` : "Let's Work Together 🤝");
    let content = parts.slice(1).join('\n\n');

    if (!content.startsWith('<div>')) {
      content = `<div>${content}</div>`;
    }
    content = content
      .replace(/<p>/g, '<div>')
      .replace(/<\/p>/g, '</div>')
      .replace(/<div><br><\/div>/gi, '<div>&nbsp;</div>')
      .replace(/\s{2,}/g, ' ');
    // Ensure greeting never starts with "Dear"—use "Hi" instead
    content = content.replace(/^(<div>\s*)Dear\s+/i, '$1Hi ');
    // Force personalized greeting: replace "Hi there" / "Hello," etc. with "Hi {first_name}," when we have recipient name
    if (recipientFirstName) {
      content = content
        .replace(/^(<div>\s*)Hi\s+there\s*,?\s*/i, `$1Hi ${recipientFirstName}, `)
        .replace(/^(<div>\s*)Hello\s*,?\s*/i, `$1Hi ${recipientFirstName}, `)
        .replace(/^(<div>\s*)Hey\s+there\s*,?\s*/i, `$1Hi ${recipientFirstName}, `)
        .replace(/^(<div>\s*)Hi\s*,?\s*(?=\s|$)/i, `$1Hi ${recipientFirstName}, `);
    }
    // Remove em dashes; use space + regular hyphen for readability
    content = content.replace(/—/g, ' - ');

    console.log('Generated email:', { model, subject, contentPreview: content.slice(0, 100) });

    return NextResponse.json({ content, subject });
  } catch (error) {
    console.error('Error generating email:', error);
    return NextResponse.json(
      { error: 'Failed to generate email content' },
      { status: 500 }
    );
  }
}

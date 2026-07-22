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

/** Run a single completion with the given model; returns the response text. */
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

interface PostRow {
  caption: string | null;
  description: string | null;
  posted_at: string;
  platform: string;
  media_type: string;
}

interface SocialAccountRow {
  id: string;
  platform: string;
  username: string;
  biography: string | null;
  followers: number | null;
  posts: PostRow[];
}

interface TalentData {
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  socialAccounts: SocialAccountRow[];
}

/** Fetch signed-in sender first name from public.users. */
async function fetchSignedInSenderFirstName(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;

    const authUser = authData.user;

    const { data: userRowById } = await supabase
      .from('users')
      .select('first_name')
      .eq('id', authUser.id)
      .maybeSingle();

    const firstNameById = userRowById?.first_name?.trim();
    if (firstNameById) return firstNameById;

    const authEmail = authUser.email?.trim().toLowerCase();
    if (!authEmail) return null;

    const { data: userRowByEmail } = await supabase
      .from('users')
      .select('first_name')
      .eq('email', authEmail)
      .maybeSingle();

    const firstNameByEmail = userRowByEmail?.first_name?.trim();
    return firstNameByEmail || null;
  } catch (err) {
    console.error('[email-gen-talent] Error fetching signed-in sender name:', err);
    return null;
  }
}

/** Fetch talent data by people.id (preferred when client already knows the person). */
async function fetchTalentDataByPersonId(personId: string): Promise<TalentData | null> {
  if (!personId?.trim()) return null;
  try {
    const supabase = await createClient();
    const { data: personRow, error } = await supabase
      .from('people')
      .select('id, first_name, last_name, headline, profile_id')
      .eq('id', personId.trim())
      .maybeSingle();

    if (error || !personRow) {
      console.log('[email-gen-talent] fetchTalentDataByPersonId: no row', {
        personId: personId.trim(),
        error: error?.message ?? null,
      });
      return null;
    }

    const profileId = personRow.profile_id;
    const socialAccounts = profileId ? await fetchSocialData(supabase, profileId) : [];

    return {
      firstName: personRow.first_name ?? null,
      lastName: personRow.last_name ?? null,
      headline: personRow.headline ?? null,
      socialAccounts,
    };
  } catch (err) {
    console.error('[email-gen-talent] Error fetching talent data by person id:', err);
    return null;
  }
}

/** Fetch talent data: person info + social accounts + recent posts, keyed by recipient email. */
async function fetchTalentData(recipientEmail: string): Promise<TalentData | null> {
  if (!recipientEmail?.trim()) return null;
  const email = recipientEmail.trim().toLowerCase();

  try {
    const supabase = await createClient();

    // Fetch person row (talent type) by email
    const { data: personRow, error: personError } = await supabase
      .from('people')
      .select('id, first_name, last_name, headline, profile_id')
      .eq('email', email)
      .eq('person_type', 'talent')
      .maybeSingle();

    if (personError || !personRow) {
      // Fallback: any person with this email regardless of type
      const { data: anyPerson, error: anyError } = await supabase
        .from('people')
        .select('id, first_name, last_name, headline, profile_id')
        .eq('email', email)
        .maybeSingle();

      if (!anyPerson) {
        console.log('[email-gen-talent] fetchTalentData: no people row for email', {
          email,
          talentQueryError: personError?.message ?? null,
          fallbackError: anyError?.message ?? null,
        });
        return null;
      }

      const profileId = anyPerson.profile_id;
      const socialAccounts = profileId ? await fetchSocialData(supabase, profileId) : [];
      return {
        firstName: anyPerson.first_name ?? null,
        lastName: anyPerson.last_name ?? null,
        headline: anyPerson.headline ?? null,
        socialAccounts,
      };
    }

    const profileId = personRow.profile_id;
    const socialAccounts = profileId ? await fetchSocialData(supabase, profileId) : [];

    return {
      firstName: personRow.first_name ?? null,
      lastName: personRow.last_name ?? null,
      headline: personRow.headline ?? null,
      socialAccounts,
    };
  } catch (err) {
    console.error('[email-gen-talent] Error fetching talent data:', err);
    return null;
  }
}

async function fetchSocialData(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string): Promise<SocialAccountRow[]> {
  const { data: accounts, error: accountsError } = await supabase
    .from('social_accounts')
    .select('id, platform, username, biography, followers')
    .eq('profile_id', profileId);

  if (accountsError || !accounts?.length) return [];

  const results: SocialAccountRow[] = [];

  for (const account of accounts) {
    // Fetch up to 10 most recent posts for each account
    const { data: posts } = await supabase
      .from('posts')
      .select('caption, description, posted_at, platform, media_type')
      .eq('social_account_id', account.id)
      .order('posted_at', { ascending: false })
      .limit(10);

    results.push({
      id: account.id,
      platform: account.platform,
      username: account.username,
      biography: account.biography ?? null,
      followers: account.followers ?? null,
      posts: (posts ?? []).map((p: PostRow) => ({
        caption: p.caption ?? null,
        description: p.description ?? null,
        posted_at: p.posted_at,
        platform: p.platform,
        media_type: p.media_type,
      })),
    });
  }

  return results;
}

/** Build context string from talent data for the AI prompt. */
function buildTalentContextString(talent: TalentData): string {
  const lines: string[] = [
    'Context about the talent we are reaching out to:',
    'Note: Only their most recent posts appear below (not full channel history). Do not write that you have followed since an older era, series, milestone, or video unless it clearly appears in this list or their bio.',
  ];

  const fullName = [talent.firstName, talent.lastName].filter(Boolean).join(' ');
  if (fullName) lines.push(`- Name: ${fullName}`);
  if (talent.headline) lines.push(`- Headline/title: ${talent.headline}`);

  for (const account of talent.socialAccounts) {
    lines.push('');
    const followersStr = account.followers ? ` (${account.followers.toLocaleString()} followers)` : '';
    lines.push(`${account.platform} — @${account.username}${followersStr}`);

    if (account.biography) {
      lines.push(`  Bio: ${account.biography}`);
    }

    const postsWithText = account.posts.filter((p) => (p.caption || p.description)?.trim());
    if (postsWithText.length > 0) {
      lines.push('  Recent posts (newest first):');
      for (const post of postsWithText.slice(0, 10)) {
        const text = (post.caption || post.description || '').trim();
        if (!text) continue;
        // Truncate long captions to keep prompt reasonable
        const truncated = text.length > 300 ? text.slice(0, 300) + '…' : text;
        lines.push(`    - ${truncated}`);
      }
    }
  }

  return lines.join('\n');
}

/** Remove trailing signature lines but keep brief closings like "Best,". */
function stripTrailingSignatureOnly(content: string): string {
  let normalized = content;

  // Remove explicit signature placeholders.
  normalized = normalized.replace(
    /<div>\s*(?:\[?\s*(?:your\s+name|first\s+name|signature)\s*\]?)\s*<\/div>\s*$/i,
    ''
  );

  // Remove common contact detail lines if they are at the very end.
  normalized = normalized
    .replace(/<div>\s*[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\s*<\/div>\s*$/i, '')
    .replace(/<div>\s*(?:\+?\d[\d\s().-]{6,}\d)\s*<\/div>\s*$/i, '');

  // Remove trailing name/title lines under a closing, while preserving the closing itself.
  normalized = normalized
    .replace(/<div>\s*[A-Za-z][A-Za-z.' -]{1,50}\s*<\/div>\s*$/i, '')
    .replace(/<div>\s*[A-Za-z][A-Za-z0-9/&,.()' -]{2,60}\s*<\/div>\s*$/i, '');

  return normalized.trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      recipientEmail,
      model: requestedModel = 'gpt-4o',
      personalInfo,
      personId: bodyPersonId,
      recipientFirstNameFallback,
    } = body as {
      recipientEmail?: string;
      model?: string;
      personalInfo?: string;
      personId?: string;
      recipientFirstNameFallback?: string;
    };

    const fallbackTrim =
      typeof recipientFirstNameFallback === 'string' ? recipientFirstNameFallback.trim() : '';

    console.log('[email-gen-talent] Request', {
      recipientEmail: typeof recipientEmail === 'string' ? recipientEmail : null,
      personId: typeof bodyPersonId === 'string' && bodyPersonId.trim() ? bodyPersonId.trim() : null,
      hasFirstNameFallback: Boolean(fallbackTrim),
      model: typeof requestedModel === 'string' ? requestedModel : 'gpt-4o',
      personalInfoLength: typeof personalInfo === 'string' ? personalInfo.trim().length : 0,
    });

    const ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
      'claude-3-5-sonnet-latest': 'claude-sonnet-4-6',
      'claude-3-opus-20240229': 'claude-opus-4-6',
      'claude-3-opus-latest': 'claude-opus-4-6',
    };
    const requested = typeof requestedModel === 'string' ? requestedModel : 'gpt-4o';
    const model = (ANTHROPIC_MODEL_ALIASES[requested] ?? requested) || 'gpt-4o';

    let talentData: TalentData | null = null;
    let talentResolvedBy: 'personId' | 'email' | null = null;

    if (typeof bodyPersonId === 'string' && bodyPersonId.trim()) {
      talentData = await fetchTalentDataByPersonId(bodyPersonId.trim());
      if (talentData) talentResolvedBy = 'personId';
    }
    if (!talentData && typeof recipientEmail === 'string') {
      talentData = await fetchTalentData(recipientEmail);
      if (talentData) talentResolvedBy = 'email';
    }

    if (!talentData) {
      console.log('[email-gen-talent] No DB talent row after personId + email lookup', {
        personId: typeof bodyPersonId === 'string' ? bodyPersonId.trim() : null,
        recipientEmail: typeof recipientEmail === 'string' ? recipientEmail.trim().toLowerCase() : null,
      });
    }

    const dbFirst = talentData?.firstName?.trim() || '';
    const recipientFirstName = dbFirst || fallbackTrim || null;

    const firstNameSource: 'db' | 'fallback' | 'none' = dbFirst
      ? 'db'
      : fallbackTrim
        ? 'fallback'
        : 'none';

    const talentForPrompt: TalentData | null = talentData
      ? { ...talentData, firstName: recipientFirstName ?? talentData.firstName }
      : recipientFirstName
        ? {
            firstName: recipientFirstName,
            lastName: null,
            headline: null,
            socialAccounts: [],
          }
        : null;

    if (talentData) {
      console.log('[email-gen-talent] Talent data resolved', {
        resolvedBy: talentResolvedBy,
        lookupKey: talentResolvedBy === 'personId' ? bodyPersonId?.trim() : recipientEmail,
        dbName: [talentData.firstName, talentData.lastName].filter(Boolean).join(' ') || '(empty)',
        greetingFirstName: recipientFirstName,
        firstNameSource,
        platforms: talentData.socialAccounts.map((a) => a.platform),
      });
    } else if (recipientFirstName) {
      console.log('[email-gen-talent] No DB row; greeting first name from client fallback only', {
        greetingFirstName: recipientFirstName,
        firstNameSource,
      });
    } else {
      console.log('[email-gen-talent] No greeting first name (DB and fallback both empty)');
    }

    const talentContextBlock = talentForPrompt ? buildTalentContextString(talentForPrompt) : '';
    const senderFirstName = await fetchSignedInSenderFirstName();
    console.log('[email-gen-talent] Sender first name (signed-in)', {
      senderFirstName: senderFirstName ?? '(none)',
    });
    const introLineInstruction = senderFirstName
      ? `My name's ${senderFirstName}, and I'm with WALLS, a full-service talent management company that handles brand partnerships, community growth, and hands-on support as creators scale. We help a select group of creators build something that lasts. We've partnered with brands like [TopBrand1], [TopBrand2], and [TopBrand3], names like Demi Lovato, J Balvin, and Lando Norris, and have helped launch creator-led products into six figures. Although we're boutique, we aim to move mountains.`
      : `My name's [SenderName], and I'm with WALLS, a full-service talent management company that handles brand partnerships, community growth, and hands-on support as creators scale. We help a select group of creators build something that lasts. We've partnered with brands like [TopBrand1], [TopBrand2], and [TopBrand3], names like Demi Lovato, J Balvin, and Lando Norris, and have helped launch creator-led products into six figures. Although we're boutique, we aim to move mountains.`;

    const systemMessage =
      (talentContextBlock ? talentContextBlock + '\n\n' : '') +
      `Write a first-touch email from WALLS to a creator: casual, human, and clear. Goal is to start a relationship, not pitch a deal.

Body structure (strict): exactly THREE paragraphs of body between the greeting and the sign-off. No fourth paragraph of pitch. No extra spacer-only divs that act like paragraphs.

1) Greeting line: "Hey [first name]," or "Hi [first name]," only (never "Hi there" / nameless hello).

Literal writing references (use these as direct tone templates; adapt details to the real recipient/context):

Example:
Hey [FirstName],

I've been following your content for a while and had to reach out, first as a fan. That hiking hack you shared? Tried it with my girlfriend, and not only did it work, we haven't had a single disagreement since - mostly because we haven't even spoken!

Jokes aside, I'm with WALLS Entertainment, a full-service talent management agency where we focus on brand partnerships, monetization strategies, product development, and digital rights management. We've done campaigns for our creators involving artists like Demi Lovato and J Balvin, plus brands like Manscaped, Shopkick, and BetterHelp.

Now that the shameless plug is out of the way, I wanted to see if you would be open to jumping on a call sometime this week, or early next. I'd love to hear more about what you have on the go, I am a fan of what you're building, and I would love to see if we can aid in its growth.

Looking forward to connecting.

Chat soon,

2) Paragraph 1 - opener only: keep this concise but natural. Usually two short sentences. Sentence 1 can start with "I'm a big fan." Sentence 2 should mention one specific video, concept, series, or collab in clean wording (for example: "I loved your video where you bought homeless people a hotel room - it was so wholesome."). Make the compliment match the actual vibe of the specific content (for example: wholesome, funny, clever, sharp, inspiring) instead of generic filler. Do not make it robotic-short or grammatically clipped. Stop after that, no follow-up interpretation/explainer like "that showed what your content is about." The specific thing must come from provided recent posts/bio (no guessing). Do NOT claim long history ("been following since...") unless explicitly in context. No "caught my attention" lines, no proving you watched, no essay.

3) Paragraph 2 - use this wording exactly (replace sender first name dynamically and replace [TopBrand1]/[TopBrand2]/[TopBrand3] with the three most relevant brands for this specific recipient): "${introLineInstruction}"
Choose those 3 brands from this pool only: DoorDash, BetterHelp, Manscaped, Google Pixel, DJI, Atlantic Records, Athena Club, Uber, Shopkick, Snipes, Scribe, Rokid, Xfinity, Twisted Tea, Sporting Life, Sony Pictures, Lionsgate, Island Records, Insta360, dossier, HomeChef, Yahoo, Skittles, KAYAK, Roamless, Lovart.

4) Paragraph 3 - CTA only: first person (I/me) only. Use this exact style: "Enough about us though. I'm really interested in hearing more about what you're building. If you have some time in the near future for a chat, I'd love to set something up." Keep it friendly and straightforward. No "we" here. Confident and short. Avoid template mush ("where you're taking things" + "whenever works") and hedge stacking. No default "this week" / "quick call" unless sender context asks.

5) Sign-off line: "Best," "All the best," or similar. No sender name, title, phone, or email below that (signature is added elsewhere).

The opener paragraph must stay the shortest. If you catch yourself writing a second pitch paragraph, stop and merge into paragraph 2.

Keep everything upbeat: no digs at the category, no backhanded praise, no surprised "you [verb]" praise that sounds skeptical.

Never mention rates, contracts, or deal terms. No "huge fan" / obsessed hype. No stiff corporate openers. Do not use the word "genuinely" anywhere (sounds like filler). Avoid corny phrasing like "stopped me mid-scroll," "it stuck with me," "long after I closed the app," or "that one was something else" (and close variants). Avoid AI-sounding promo lines like "exactly the kind of content" and "exactly the kind of person we love working with." Keep tone professional, kind, charming, and casual. No em dashes - use commas, periods, or hyphens.

Whenever the word WALLS appears in the body HTML, use exactly:
<a href="https://www.wallsentertainment.com/" target="_blank" rel="noopener noreferrer">WALLS</a>

Subject line (under ~50 chars, casual). Prefer: "[FirstName] x WALLS | Name a Better Duo" when it fits; otherwise "[FirstName] x WALLS | Quick Idea" or "[FirstName] x WALLS | Should We Chat?"

Output format: Start with "SUBJECT LINE:" then the subject on its own line, then two newlines, then the body as HTML using <div> and <div>&nbsp;</div> for spacing (Gmail-friendly).`;

    const userMessage = `Talent first name for greeting (MUST use this — open with "Hey [this name]," or "Hi [this name],"): ${recipientFirstName ?? '(none provided)'}

Sender first name for self-intro (if provided, use naturally as "My name's [name]..."): ${senderFirstName ?? '(none provided)'}

Additional context from sender (use for a simple personal tie in the opener when helpful - place you care about, shared interest, etc.; optional): "${(personalInfo ?? '').trim() || '(none)'}"

Write the outreach email. Body must be exactly three paragraphs between greeting and sign-off (opener, WALLS pitch, CTA). Start with "SUBJECT LINE:" then the subject, then two newlines, then the HTML body with <div> tags.`;

    const responseText = await runCompletion(model, systemMessage, userMessage);

    const parts = responseText.split('\n\n');
    const subject = parts[0].replace(/^SUBJECT LINE:\s*/i, '').trim() ||
      (recipientFirstName ? `${recipientFirstName} x WALLS | Name a Better Duo` : 'WALLS | Quick Idea');
    let content = parts.slice(1).join('\n\n');

    if (!content.startsWith('<div>')) {
      content = `<div>${content}</div>`;
    }
    content = content
      .replace(/<p>/g, '<div>')
      .replace(/<\/p>/g, '</div>')
      .replace(/<div><br><\/div>/gi, '<div>&nbsp;</div>')
      .replace(/\s{2,}/g, ' ');

    // Ensure greeting uses "Hey" or "Hi" not "Dear"
    content = content.replace(/^(<div>\s*)Dear\s+/i, '$1Hey ');

    // Force personalized greeting if we have a name
    if (recipientFirstName) {
      content = content
        .replace(/^(<div>\s*)Hi\s+there\s*,?\s*/i, `$1Hey ${recipientFirstName}, `)
        .replace(/^(<div>\s*)Hello\s*,?\s*/i, `$1Hey ${recipientFirstName}, `)
        .replace(/^(<div>\s*)Hey\s+there\s*,?\s*/i, `$1Hey ${recipientFirstName}, `)
        .replace(/^(<div>\s*)Hi\s*,?\s*(?=\s|$)/i, `$1Hey ${recipientFirstName}, `);
    }

    // Remove em dashes
    content = content.replace(/—/g, ' - ');

    // Ban filler intensifiers (prompt asks too; strip if model ignores)
    content = content
      .replace(/\bgenuinely\b/gi, '')
      .replace(/\bactually\b/gi, '')
      .replace(/\bwe(?:'ve| have)\s+represented\b/gi, "we've worked with")
      .replace(/\bI(?:'ve| have)\s+represented\b/gi, "I've worked with")
      .replace(/\bon\s+the\s+talent\s+side\s+with\s+([A-Za-z ,.'&-]+?)([.!?]|,)/gi, "through campaigns for our creators with $1$2")
      .replace(/\bwe(?:'ve| have)\s+worked\s+with\s+(Demi\s+Lovato|J\s*Balvin|Lando\s+Norris)\b(?![^.]{0,80}(?:for\s+our\s+creators|for\s+our\s+roster|through\s+campaigns))/gi, "we've worked with $1 through campaigns for our creators")
      .replace(/\bstopped\s+me\s+mid[-\s]?scroll\b/gi, 'stood out to me')
      .replace(/\bit\s+stuck\s+with\s+me\b/gi, 'I really liked it')
      .replace(/\bmoving\s+watch\b/gi, 'great watch')
      .replace(/\blong\s+after\s+i\s+closed\s+the\s+app\b/gi, 'afterward')
      .replace(/\bthat\s+one\s+was\s+something\s+else\b/gi, 'that was so wholesome')
      .replace(/\bexactly\s+the\s+kind\s+of\s+content\b/gi, 'the kind of content')
      .replace(/\bexactly\s+the\s+kind\s+of\s+person\s+we\s+love\s+working\s+with\b/gi, 'someone we would love to work with')
      .replace(/\bgenuine,\s*unscripted\s+moments\b/gi, 'real moments')
      .replace(/\bat\s+the\s+scale\s+you'?re\s+at,\s*with\s+the\s+range\s+you'?ve\s+shown\b/gi, '')
      .replace(/\s*[-,]\s*that\s+(?:one\s+)?(?:really\s+)?showed\s+what\s+your\s+content\s+is\s+all\s+about\.?/gi, '.')
      .replace(/\s{2,}/g, ' ');

    // Ensure WALLS is always hyperlinked in body HTML
    const wallsAnchor =
      '<a href="https://www.wallsentertainment.com/" target="_blank" rel="noopener noreferrer">WALLS</a>';
    content = content.replace(/\bWALLS\b/g, wallsAnchor);

    // Keep brief closing lines, strip only name/signature lines under them.
    content = stripTrailingSignatureOnly(content);

    console.log('[email-gen-talent] Generated email:', {
      model,
      subject,
      greetingFirstNameUsed: recipientFirstName,
      firstNameSource,
      contentPreview: content.slice(0, 100),
    });

    return NextResponse.json({ content, subject });
  } catch (error) {
    console.error('[email-gen-talent] Error generating email:', error);
    return NextResponse.json(
      { error: 'Failed to generate talent outreach email' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

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

export async function POST(req: Request) {
  try {
    const {
      currentContent,
      editInstructions,
      model: requestedModel = 'claude-sonnet-4-6',
    } = await req.json();

    if (!currentContent || typeof currentContent !== 'string') {
      return NextResponse.json({ error: 'currentContent is required' }, { status: 400 });
    }
    if (!editInstructions || typeof editInstructions !== 'string') {
      return NextResponse.json({ error: 'editInstructions is required' }, { status: 400 });
    }

    const ANTHROPIC_ALIASES: Record<string, string> = {
      'claude-3-5-sonnet-20241022': 'claude-sonnet-4-6',
      'claude-3-5-sonnet-latest': 'claude-sonnet-4-6',
      'claude-3-opus-20240229': 'claude-opus-4-6',
      'claude-3-opus-latest': 'claude-opus-4-6',
    };
    const model = (ANTHROPIC_ALIASES[requestedModel] ?? requestedModel) || 'claude-sonnet-4-6';

    const systemMessage = `You are editing an existing email. Your job is to apply ONLY the specific changes the user requests. Do NOT rewrite the entire email unless the user explicitly asks for a full rewrite. Keep every unchanged sentence, phrase, and word exactly the same — do not paraphrase, restructure, or "improve" anything that was not asked to change. Return the complete email HTML body using <div> tags for each paragraph (e.g. <div>Paragraph text here.</div> and <div>&nbsp;</div> for blank lines), in the same format as the input. Do NOT include a subject line or "SUBJECT LINE:". Output only the HTML body.`;

    const userMessage = `Existing email (HTML):
${currentContent.trim()}

Edit instructions: ${editInstructions.trim()}

Return the complete edited email HTML body, changing only what was requested. All other content must remain word-for-word identical.`;

    const responseText = await runCompletion(model, systemMessage, userMessage);
    let content = responseText.trim();

    // Normalize to div-based HTML
    if (!content.startsWith('<div>') && !content.startsWith('<p>')) {
      content = `<div>${content}</div>`;
    }
    content = content
      .replace(/<p>/g, '<div>')
      .replace(/<\/p>/g, '</div>')
      .replace(/<div><br><\/div>/gi, '<div>&nbsp;</div>')
      .replace(/—/g, ' - ');

    console.log('[email-edit] Edit applied:', { model, contentPreview: content.slice(0, 100) });

    return NextResponse.json({ content });
  } catch (error) {
    console.error('[email-edit] Error editing email:', error);
    return NextResponse.json({ error: 'Failed to edit email content' }, { status: 500 });
  }
}

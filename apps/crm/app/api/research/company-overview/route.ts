import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// Add Edge runtime directive
export const runtime = 'edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getSearchResults(query: string) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_BROWSER_API_KEY}&cx=${process.env.GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return data.items?.map((item: any) => 
      `Title: ${item.title}\nLink: ${item.link}\nSnippet: ${item.snippet}`
    ).join('\n\n') || '';
  } catch (error) {
    console.error('Search error:', error);
    return '';
  }
}

async function getAIAnalysis(searchContext: string, companyName: string, website: string) {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a business research assistant. Provide a professional and concise company overview based on verified information. If you cannot verify the information, indicate uncertainty or omit it."
      },
      {
        role: "user",
        content: `Based on these search results:\n${searchContext}\n\nWrite a professional and concise overview of ${companyName} (${website}). 
        Include information about:
        - What the company does (main products/services)
        - Industry focus
        - Target market/customers
        - Any notable achievements or market position
        - Year founded (if available)
        - Company size/scale (if available)
        
        Keep it concise but informative, around 2-3 paragraphs.`
      }
    ],
    model: "gpt-4-turbo-preview",
  });

  return completion.choices[0].message.content;
}

export async function POST(req: Request) {
  try {
    const { companyName, website } = await req.json();

    if (!companyName || !website) {
      return NextResponse.json(
        { error: 'Company name and website are required' },
        { status: 400 }
      );
    }

    const searchQuery = `${companyName} ${website} company about business`;
    const searchContext = await getSearchResults(searchQuery);
    
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    getAIAnalysis(searchContext, companyName, website)
      .then(async (analysis) => {
        await writer.write(encoder.encode(JSON.stringify({ companyOverview: analysis })));
        await writer.close();
      })
      .catch(async (error) => {
        await writer.write(encoder.encode(JSON.stringify({ 
          error: 'Failed to research company', 
          details: error.message 
        })));
        await writer.close();
      });

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked'
      }
    });

  } catch (error) {
    console.error('Error researching company:', error);
    return NextResponse.json(
      { error: 'Failed to research company', details: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { quoteId, recipientType = "PRIVATE", details } = await request.json();

  if (!quoteId) {
    return NextResponse.json({ error: "Missing quote ID" }, { status: 400 });
  }

  try {
    const url = `https://api.transferwise.com/v1/quotes/${quoteId}/account-requirements`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WISE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Accept-Minor-Version": "1",
      },
      body: JSON.stringify({
        recipientType,
        details,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('Wise API Error:', {
        status: response.status,
        error,
        requestParams: {
          quoteId,
          recipientType
        }
      });
      return NextResponse.json({ error }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch account requirements" }, { status: 500 });
  }
}

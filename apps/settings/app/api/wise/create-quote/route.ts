import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceCurrency, targetCurrency, sourceAmount } = body;
    const profile = process.env.WISE_PROFILE_ID || "56048975";

    if (!sourceCurrency || !targetCurrency || !sourceAmount) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.transferwise.com/v1/quotes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WISE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile,
        sourceCurrency,
        targetCurrency,
        sourceAmount: parseFloat(sourceAmount),
        targetAmount: null,
        rateType: "FIXED",
        source: sourceCurrency,
        target: targetCurrency,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Wise Quote API Error:", {
        status: response.status,
        error,
        requestParams: { sourceCurrency, targetCurrency, sourceAmount, profile },
      });
      return NextResponse.json({ error }, { status: response.status });
    }

    const quote = await response.json();
    return NextResponse.json(quote);
  } catch (error) {
    console.error("Create quote error:", error);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}

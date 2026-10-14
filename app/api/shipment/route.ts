import { NextRequest, NextResponse } from "next/server";
import { lookupShipment } from "./domain.mjs";

export async function GET(request: NextRequest) {
  const trackingNumber = request.nextUrl.searchParams.get("trackingNumber");
  const result = lookupShipment(trackingNumber);
  if (result.code === "INVALID_TRACKING_NUMBER") {
    return NextResponse.json({ error: "Takip numarası 10 veya 12 rakam olmalıdır." }, { status: 400 });
  }
  if (!result.found) {
    return NextResponse.json({ error: "Bu takip numarası demo gönderi kayıtlarında bulunamadı.", code: result.code }, { status: 404 });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

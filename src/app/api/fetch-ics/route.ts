import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const calendarUrl = new URL(url);
    if (!['http:', 'https:'].includes(calendarUrl.protocol)) {
      return NextResponse.json({ error: "Only HTTP and HTTPS calendar URLs are supported" }, { status: 400 });
    }

    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(calendarUrl, {
          cache: "no-store",
          headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8" },
          signal: AbortSignal.timeout(15_000),
        });
        if (response.ok || response.status < 500) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!response) throw lastError || new Error("The calendar server did not respond");
    if (!response.ok) {
      return NextResponse.json(
        { error: `Calendar server returned ${response.status}${response.statusText ? ` (${response.statusText})` : ""}` },
        { status: 502 }
      );
    }

    const content = await response.text();
    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error fetching ICS:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch ICS file" }, { status: 502 });
  }
}

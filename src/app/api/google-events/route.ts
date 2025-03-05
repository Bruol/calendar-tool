import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("google_access_token");

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId") || "primary";
    const timeMin = searchParams.get("timeMin");
    const timeMax = searchParams.get("timeMax");

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
      )}/events?${new URLSearchParams({
        timeMin: timeMin || new Date().toISOString(),
        timeMax:
          timeMax ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        singleEvents: "true",
        orderBy: "startTime",
      })}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken.value}`,
        },
      }
    );

    const events = await eventsResponse.json();

    if (!eventsResponse.ok) {
      throw new Error(events.error || "Failed to fetch events");
    }

    return NextResponse.json(events);
  } catch (error: any) {
    console.error("Google events error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch events" },
      { status: 500 }
    );
  }
}

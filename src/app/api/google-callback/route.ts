import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.REDIRECT_URI || "http://localhost:3000/api/google-callback";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }
  console.log("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
  console.log("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);
  console.log("REDIRECT_URI", REDIRECT_URI);

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokens.error || "Failed to exchange code for tokens");
    }

    // Get user's calendars
    const calendarsResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const calendars = await calendarsResponse.json();

    if (!calendarsResponse.ok) {
      throw new Error(calendars.error || "Failed to fetch calendars");
    }

    // Store tokens in a secure HTTP-only cookie
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("google_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600, // 1 hour
    });

    return response;
  } catch (error: any) {
    console.error("Google callback error:", error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}

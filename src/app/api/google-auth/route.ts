import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.REDIRECT_URI || "http://localhost:3000/api/google-callback";

export async function GET() {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  console.log("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
  console.log("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);
  console.log("REDIRECT_URI", REDIRECT_URI);

  authUrl.searchParams.append("client_id", GOOGLE_CLIENT_ID!);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append(
    "scope",
    "https://www.googleapis.com/auth/calendar.readonly"
  );
  authUrl.searchParams.append("access_type", "offline");
  authUrl.searchParams.append("prompt", "consent");

  return NextResponse.json({ url: authUrl.toString() });
}

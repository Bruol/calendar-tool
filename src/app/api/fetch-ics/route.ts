import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ICS file: ${response.statusText}`);
    }

    const content = await response.text();
    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error fetching ICS:", error);
    return NextResponse.json(
      { error: "Failed to fetch ICS file" },
      { status: 500 }
    );
  }
}

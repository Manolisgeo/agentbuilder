import { createOAuthClient, GMAIL_SCOPES } from "@/lib/gmail-oauth";

export async function GET() {
  try {
    const oauth2Client = await createOAuthClient();
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GMAIL_SCOPES,
      prompt: "consent",
    });
    return Response.redirect(url);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "OAuth setup failed" },
      { status: 500 }
    );
  }
}

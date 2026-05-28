import { type NextRequest } from "next/server";
import { createOAuthClient } from "@/lib/gmail-oauth";
import { writeTokens, type GmailTokens } from "@/lib/gmail-tokens";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return Response.json({ error: `Google OAuth error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return Response.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    const oauth2Client = await createOAuthClient();

    oauth2Client.on("tokens", async (tokens) => {
      if (tokens.refresh_token || tokens.access_token) {
        const current = await import("@/lib/gmail-tokens").then((m) =>
          m.readTokens()
        );
        await writeTokens({
          access_token: tokens.access_token ?? current?.access_token ?? "",
          refresh_token: tokens.refresh_token ?? current?.refresh_token ?? "",
          expiry_date: tokens.expiry_date ?? current?.expiry_date ?? 0,
        });
      }
    });

    const { tokens } = await oauth2Client.getToken(code);

    await writeTokens({
      access_token: tokens.access_token ?? "",
      refresh_token: tokens.refresh_token ?? "",
      expiry_date: tokens.expiry_date ?? 0,
    } as GmailTokens);

    return Response.redirect(new URL("/?gmail=connected", req.nextUrl.origin));
  } catch (err) {
    console.error("OAuth callback error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Token exchange failed" },
      { status: 500 }
    );
  }
}

import "server-only";
import { google } from "googleapis";
import { z } from "zod";
import type { OAuth2Client } from "google-auth-library";
import type { AgentSpec } from "@/lib/agent-spec";

export class GmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailError";
  }
}

export function hasGmailTools(spec: AgentSpec): boolean {
  return spec.tools.some(
    (t) => t.type === "gmail_read_inbox" || t.type === "gmail_send_digest"
  );
}

function encodeEmail(to: string, subject: string, html: string): string {
  const message = [
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    html,
  ].join("\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createGmailReadInboxTool(oauth2Client: OAuth2Client) {
  return {
    description:
      "Fetch unread emails from the Gmail inbox from the last hour. Returns sender, subject, snippet, and date for each message.",
    inputSchema: z.object({
      hoursBack: z.number().default(1).describe("How many hours back to fetch"),
    }),
    execute: async ({ hoursBack }: { hoursBack: number }) => {
      try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const listRes = await gmail.users.messages.list({
          userId: "me",
          q: `is:unread newer_than:${hoursBack}h`,
          maxResults: 20,
        });

        const messages = listRes.data.messages ?? [];
        if (messages.length === 0) return { emails: [], count: 0 };

        const emails = await Promise.all(
          messages.map(async (msg) => {
            const full = await gmail.users.messages.get({
              userId: "me",
              id: msg.id!,
              format: "metadata",
              metadataHeaders: ["From", "Subject", "Date"],
            });

            const headers = full.data.payload?.headers ?? [];
            const get = (name: string) =>
              headers.find((h) => h.name === name)?.value ?? "";

            return {
              id: msg.id,
              from: get("From"),
              subject: get("Subject"),
              date: get("Date"),
              snippet: full.data.snippet ?? "",
            };
          })
        );

        return { emails, count: emails.length };
      } catch (error) {
        throw new GmailError(
          error instanceof Error ? error.message : "Failed to read inbox"
        );
      }
    },
  };
}

export function createGmailSendDigestTool(oauth2Client: OAuth2Client) {
  return {
    description:
      "Send an HTML email digest to the authenticated user's Gmail inbox.",
    inputSchema: z.object({
      subject: z.string().describe("Email subject line"),
      html: z.string().describe("HTML body of the digest email"),
    }),
    execute: async ({ subject, html }: { subject: string; html: string }) => {
      try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const profileRes = await gmail.users.getProfile({ userId: "me" });
        const emailAddress = profileRes.data.emailAddress ?? "me";

        const raw = encodeEmail(emailAddress, subject, html);

        await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw },
        });

        return { sent: true, to: emailAddress, subject };
      } catch (error) {
        throw new GmailError(
          error instanceof Error ? error.message : "Failed to send digest"
        );
      }
    },
  };
}

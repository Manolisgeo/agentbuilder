import {
  convertToModelMessages,
  generateObject,
  generateText,
  stepCountIs,
  streamText,
  type ModelMessage,
  type UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import type { FbSearchOptions } from "@/lib/fb-marketplace/types";
import {
  buildAgentRuntimePrompt,
  buildOrchestratorRuntimePrompt,
  buildSubAgentRuntimePrompt,
  hasGmailTools,
  hasWebSearchTool,
} from "@/lib/agent-prompt";
import type { AgentSpec, SwarmAgent } from "@/lib/agent-spec";
import type {
  OrchestrationState,
  OrchestrationStep,
  PreviewUIMessage,
  WebSearchResult,
} from "@/lib/preview-types";
import { getChatModel } from "@/lib/deepseek";
import { extractHtmlFromLlmOutput } from "@/lib/frontend-codegen";
import {
  formatWebSearchForPrompt,
  isWebSearchConfigured,
  webSearch,
  WebSearchError,
} from "@/lib/web-search";
import { readTokens, writeTokens } from "@/lib/gmail-tokens";
import { createOAuthClient } from "@/lib/gmail-oauth";
import {
  createGmailReadInboxTool,
  createGmailSendDigestTool,
} from "@/lib/gmail-tools";
import type { ArticleData, ArticlesFeedData, DashboardData } from "@/lib/preview-types";

type PreviewWriter = UIMessageStreamWriter<PreviewUIMessage>;

const MAX_DASHBOARD_HTML_BYTES = 200_000;

function createDashboardTool(writer: PreviewWriter) {
  return {
    renderDashboard: {
      description:
        "Render a rich HTML dashboard to the user. Call this after fetching data via other tools. Pass a complete, self-contained HTML document with inline <style> blocks. Do not use fetch() or XHR inside the HTML — all data must be baked in.",
      inputSchema: z.object({
        title: z.string().describe("Short heading shown above the dashboard card"),
        html: z.string().describe(
          "A complete HTML document (including <html>, <head>, <style>, <body>) to render in a sandboxed iframe"
        ),
      }),
      execute: async ({ title, html }: { title: string; html: string }) => {
        // Strip markdown fences the model may wrap around the HTML
        const extracted = extractHtmlFromLlmOutput(html) ?? html.trim();
        if (extracted.length > MAX_DASHBOARD_HTML_BYTES) {
          return {
            success: false,
            error: `HTML exceeds ${MAX_DASHBOARD_HTML_BYTES / 1000} KB limit. Reduce content.`,
          };
        }
        if (!extracted.startsWith("<")) {
          return { success: false, error: "html must be a valid HTML string starting with '<'." };
        }
        const dashboard: DashboardData = {
          id: crypto.randomUUID(),
          title: title.trim() || "Dashboard",
          html: extracted,
        };
        writer.write({
          type: "data-dashboard",
          id: `dashboard-${dashboard.id}`,
          data: dashboard,
        });
        return { success: true };
      },
    },
  };
}

const articleSchema = z.object({
  title: z.string().describe("Headline of the article"),
  summary: z.string().describe("2-4 sentence summary of the article"),
  source: z.string().describe("Publication or outlet name, e.g. 'Reuters'"),
  url: z.string().describe("Full URL to the article"),
  imageUrl: z.string().optional().describe("Direct URL to a representative image (optional)"),
  publishedAt: z.string().optional().describe("ISO 8601 or human-readable publish time, e.g. '2025-05-28T14:00:00Z'"),
  category: z.string().optional().describe("Topic category, e.g. 'Politics', 'Tech', 'World'"),
});

function createArticlesTool(writer: PreviewWriter) {
  return {
    renderArticles: {
      description:
        "Render a rich news article feed with cards to the user. Call this instead of plain text when returning news stories, search results, or any list of articles. Pass structured article data — the UI will display them as interactive cards with summaries, sources, and links.",
      inputSchema: z.object({
        title: z.string().describe("Feed heading, e.g. 'Top Stories Today' or 'US Politics Briefing'"),
        articles: z.array(articleSchema).min(1).max(20).describe("List of articles to display"),
      }),
      execute: async ({
        title,
        articles,
      }: {
        title: string;
        articles: Array<{
          title: string;
          summary: string;
          source: string;
          url: string;
          imageUrl?: string;
          publishedAt?: string;
          category?: string;
        }>;
      }) => {
        const feed: ArticlesFeedData = {
          id: crypto.randomUUID(),
          title: title.trim() || "Latest Stories",
          articles: articles.map((a): ArticleData => ({ id: crypto.randomUUID(), ...a })),
        };
        writer.write({
          type: "data-articlesFeed",
          id: `feed-${feed.id}`,
          data: feed,
        });
        return { success: true, count: feed.articles.length };
      },
    },
  };
}

const routingSchema = z.object({
  subAgentId: z
    .string()
    .nullable()
    .describe(
      "ID of the sub-agent to delegate to, or null if the orchestrator should respond directly"
    ),
  routingMessage: z
    .string()
    .describe(
      'Short routing status, e.g. "Routing to Research Agent..." or "Handling directly"'
    ),
  needsWebSearch: z
    .boolean()
    .describe("Whether live web search is needed before answering"),
  searchQuery: z
    .string()
    .optional()
    .describe("Focused search query when needsWebSearch is true"),
});

function getLastUserText(messages: ModelMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;

    if (typeof message.content === "string") {
      return message.content;
    }

    const textParts = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text);
    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return "";
}

function createOrchestrationEmitter(writer: PreviewWriter) {
  const orchestrationId = `orchestration-${Date.now()}`;
  const steps: OrchestrationStep[] = [];

  const emit = () => {
    writer.write({
      type: "data-orchestration",
      id: orchestrationId,
      data: { steps: [...steps] },
    });
  };

  const upsert = (step: OrchestrationStep) => {
    const index = steps.findIndex((existing) => existing.id === step.id);
    if (index === -1) {
      steps.push(step);
    } else {
      steps[index] = step;
    }
    emit();
  };

  const completeActive = () => {
    for (const step of steps) {
      if (step.status === "active") {
        step.status = "done";
      }
    }
    emit();
  };

  return { upsert, completeActive, steps };
}

function createWebSearchTool() {
  return {
    web_search: {
      description:
        "Search the web for current information, news, facts, or recent events. Use when the user asks about timely topics or information you do not know.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
      }),
      execute: async ({ query }: { query: string }) => {
        try {
          const result = await webSearch(query);
          return {
            query: result.query,
            sources: result.sources,
            answer: result.answer ?? null,
          };
        } catch (error) {
          const message =
            error instanceof WebSearchError
              ? error.message
              : "Web search failed unexpectedly.";
          return { error: message, query, sources: [] };
        }
      },
    },
  };
}

function createFbMarketplaceTool(spec: AgentSpec) {
  if (!spec.tools.some((t) => t.type === "fb_marketplace_search")) return undefined;

  return {
    fb_marketplace_search: {
      description:
        "Search Facebook Marketplace listings by keyword, location, and price range. " +
        "Returns a list of listings with title, price, location, and URL. " +
        "After getting results, always call renderDashboard to display them visually.",
      inputSchema: z.object({
        query: z.string().describe("Search keyword, e.g. 'road bike', 'mountain bike'"),
        location: z
          .string()
          .optional()
          .describe(
            "City name, e.g. 'San Francisco, CA'. Supported: San Francisco, New York, Los Angeles, Chicago, Seattle, Austin, Miami, Boston, Denver, Portland"
          ),
        minPrice: z.number().optional().describe("Minimum price in USD"),
        maxPrice: z.number().optional().describe("Maximum price in USD"),
        limit: z.number().optional().default(10).describe("Max listings to return (max 20)"),
      }),
      execute: async ({
        query,
        location,
        minPrice,
        maxPrice,
        limit,
      }: FbSearchOptions) => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/tools/fb-marketplace`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query, location, minPrice, maxPrice, limit }),
            }
          );
          return await res.json();
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to search marketplace",
          };
        }
      },
    },
  };
}

async function createGmailTools(spec: AgentSpec) {
  const tokens = await readTokens();
  if (!tokens) return null;

  const oauth2Client = await createOAuthClient(spec.envVars ?? undefined);
  oauth2Client.setCredentials(tokens);
  oauth2Client.on("tokens", async (refreshed) => {
    await writeTokens({
      access_token: refreshed.access_token ?? tokens.access_token,
      refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
      expiry_date: refreshed.expiry_date ?? tokens.expiry_date,
    });
  });

  const tools: Record<string, unknown> = {};
  if (spec.tools.some((t) => t.type === "gmail_read_inbox")) {
    tools.gmail_read_inbox = createGmailReadInboxTool(oauth2Client);
  }
  if (spec.tools.some((t) => t.type === "gmail_send_digest")) {
    tools.gmail_send_digest = createGmailSendDigestTool(oauth2Client);
  }
  return tools;
}

async function runSingleAgentPreview(
  spec: AgentSpec,
  modelMessages: ModelMessage[],
  writer: PreviewWriter
) {
  const webTools = hasWebSearchTool(spec) ? createWebSearchTool() : undefined;

  let gmailTools: Record<string, unknown> | undefined;
  if (hasGmailTools(spec)) {
    const built = await createGmailTools(spec);
    if (!built) {
      writer.write({
        type: "data-gmailAuthRequired",
        id: "gmail-auth",
        data: { redirectUrl: "/api/auth/google" },
      });
      return;
    }
    gmailTools = built;
  }

  const dashboardTool = createDashboardTool(writer);
  const articlesTool = createArticlesTool(writer);
  const fbMarketplaceTool = createFbMarketplaceTool(spec);
  const tools = { ...webTools, ...gmailTools, ...fbMarketplaceTool, ...dashboardTool, ...articlesTool } as Record<string, unknown>;

  const liveToolsActive =
    Object.keys({ ...webTools, ...gmailTools }).length > 0 ||
    fbMarketplaceTool !== undefined;

  const result = streamText({
    model: getChatModel(),
    system: buildAgentRuntimePrompt(spec, { liveTools: liveToolsActive }),
    messages: modelMessages,
    tools: tools as Parameters<typeof streamText>[0]["tools"],
    stopWhen: stepCountIs(5),
  });

  writer.merge(result.toUIMessageStream());
}

async function runSwarmPreview(
  spec: AgentSpec,
  modelMessages: ModelMessage[],
  writer: PreviewWriter
) {
  const subAgents = spec.agents ?? [];
  const userText = getLastUserText(modelMessages);
  const orchestration = createOrchestrationEmitter(writer);
  const canSearch = hasWebSearchTool(spec) && isWebSearchConfigured();

  orchestration.upsert({
    id: "routing",
    kind: "routing",
    label: "Analyzing request",
    detail: `${spec.name} is deciding how to route this…`,
    agentRole: spec.persona.role || spec.name,
    status: "active",
  });

  const routing = await generateObject({
    model: getChatModel(),
    schema: routingSchema,
    system: buildOrchestratorRuntimePrompt(spec),
    prompt: `User message:\n${userText}\n\nChoose the best sub-agent to handle this, or respond directly if no delegation is needed. Set needsWebSearch true when fresh web data would materially improve the answer.`,
  });

  const targetSubAgent = routing.object.subAgentId
    ? subAgents.find((agent) => agent.id === routing.object.subAgentId)
    : undefined;

  orchestration.completeActive();
  orchestration.upsert({
    id: "routing",
    kind: "routing",
    label: targetSubAgent ? "Routing" : "Orchestrator engaged",
    detail: routing.object.routingMessage,
    agentRole: spec.persona.role || spec.name,
    status: "done",
  });

  let searchResult: WebSearchResult | undefined;
  let subAgentOutput: string | undefined;

  if (targetSubAgent) {
    orchestration.upsert({
      id: "delegate",
      kind: "delegate",
      label: `Delegating to ${targetSubAgent.role}`,
      detail: targetSubAgent.instructions.slice(0, 160),
      agentRole: targetSubAgent.role,
      status: "active",
    });

    if (routing.object.needsWebSearch && canSearch) {
      const query =
        routing.object.searchQuery?.trim() ||
        userText ||
        "latest relevant information";

      orchestration.upsert({
        id: "tool",
        kind: "tool",
        label: "Web search",
        detail: query,
        agentRole: targetSubAgent.role,
        status: "active",
      });

      try {
        searchResult = await webSearch(query);
        orchestration.upsert({
          id: "tool",
          kind: "tool",
          label: "Web search complete",
          detail: `${searchResult.sources.length} sources found`,
          agentRole: targetSubAgent.role,
          status: "done",
          searchResult,
        });
      } catch (error) {
        orchestration.upsert({
          id: "tool",
          kind: "tool",
          label: "Web search failed",
          detail:
            error instanceof WebSearchError
              ? error.message
              : "Unable to reach search provider.",
          agentRole: targetSubAgent.role,
          status: "error",
        });
      }
    }

    subAgentOutput = await runSubAgent(
      targetSubAgent,
      userText,
      searchResult
    );

    orchestration.upsert({
      id: "delegate",
      kind: "delegate",
      label: `${targetSubAgent.role} finished`,
      detail: "Sub-agent work complete — handing back to orchestrator",
      agentRole: targetSubAgent.role,
      status: "done",
    });
  } else if (routing.object.needsWebSearch && canSearch) {
    const query =
      routing.object.searchQuery?.trim() ||
      userText ||
      "latest relevant information";

    orchestration.upsert({
      id: "tool",
      kind: "tool",
      label: "Web search",
      detail: query,
      agentRole: spec.persona.role || spec.name,
      status: "active",
    });

    try {
      searchResult = await webSearch(query);
      orchestration.upsert({
        id: "tool",
        kind: "tool",
        label: "Web search complete",
        detail: `${searchResult.sources.length} sources found`,
        agentRole: spec.persona.role || spec.name,
        status: "done",
        searchResult,
      });
    } catch (error) {
      orchestration.upsert({
        id: "tool",
        kind: "tool",
        label: "Web search failed",
        detail:
          error instanceof WebSearchError
            ? error.message
            : "Unable to reach search provider.",
        agentRole: spec.persona.role || spec.name,
        status: "error",
      });
    }
  }

  orchestration.upsert({
    id: "synthesize",
    kind: "synthesize",
    label: "Synthesizing response",
    detail: targetSubAgent
      ? `${spec.name} is composing the final answer…`
      : `${spec.name} is responding…`,
    agentRole: spec.persona.role || spec.name,
    status: "active",
  });

  const synthesisPrompt = buildSynthesisPrompt(
    userText,
    targetSubAgent,
    subAgentOutput,
    searchResult
  );

  const result = streamText({
    model: getChatModel(),
    system: buildAgentRuntimePrompt(spec, {
      liveTools: false,
      swarmMode: true,
    }),
    messages: [{ role: "user", content: synthesisPrompt }],
  });

  writer.merge(result.toUIMessageStream());

  orchestration.completeActive();
  orchestration.upsert({
    id: "synthesize",
    kind: "synthesize",
    label: "Response ready",
    detail: "Orchestration complete",
    agentRole: spec.persona.role || spec.name,
    status: "done",
  });
}

async function runSubAgent(
  subAgent: SwarmAgent,
  userText: string,
  searchResult?: WebSearchResult
): Promise<string> {
  const context = searchResult
    ? `\n\nLive web search results:\n${formatWebSearchForPrompt(searchResult)}`
    : "";

  const result = await generateText({
    model: getChatModel(),
    system: buildSubAgentRuntimePrompt(subAgent),
    prompt: `End-user request:\n${userText}${context}\n\nProvide your specialist output for the orchestrator. Be thorough but concise.`,
  });

  return result.text;
}

function buildSynthesisPrompt(
  userText: string,
  subAgent: SwarmAgent | undefined,
  subAgentOutput: string | undefined,
  searchResult: WebSearchResult | undefined
): string {
  const parts = [`End-user message:\n${userText}`];

  if (subAgent && subAgentOutput) {
    parts.push(
      `\nSub-agent "${subAgent.role}" output:\n${subAgentOutput}`
    );
  }

  if (searchResult) {
    parts.push(
      `\nWeb search context:\n${formatWebSearchForPrompt(searchResult)}`
    );
  }

  parts.push(
    "\nWrite the final end-user response. Stay in character. Cite sources naturally when web search was used. Do not mention internal orchestration unless helpful."
  );

  return parts.join("\n");
}

export async function runPreviewStream(
  spec: AgentSpec,
  messages: PreviewUIMessage[],
  writer: PreviewWriter
) {
  const modelMessages = await convertToModelMessages(messages);
  const isSwarm = Boolean(spec.agents?.length);

  if (isSwarm) {
    await runSwarmPreview(spec, modelMessages, writer);
    return;
  }

  await runSingleAgentPreview(spec, modelMessages, writer);
}

export type { OrchestrationState };

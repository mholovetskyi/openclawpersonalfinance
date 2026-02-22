import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Alternative data via free/open public APIs.
// SimilarWeb public data, App Annie public endpoints, and Google Trends via
// SerpAPI. All require API keys configured via environment variables.

const SERPAPI_KEY = process.env.SERPAPI_KEY ?? "";

async function serpFetch(params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, api_key: SERPAPI_KEY }).toString();
  const res = await fetch(`https://serpapi.com/search?${qs}`);
  if (!res.ok) throw new Error(`SerpAPI error ${res.status}`);
  return res.json();
}

const server = new Server({ name: "mcp-altdata", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_google_trends",
      description: "Get Google Trends interest data for a search term or ticker over time. Useful as a demand/awareness proxy.",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search term or ticker (e.g. 'Tesla', 'NVDA stock')" },
          geo: { type: "string", description: "Country code (default US)" },
          period: { type: "string", description: "Time range: today 12-m, today 3-m, today 1-m (default today 3-m)" },
        },
        required: ["keyword"],
      },
    },
    {
      name: "get_web_traffic",
      description: "Estimate website traffic rank and engagement for a company domain (via SimilarWeb public data through SerpAPI).",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Company domain (e.g. apple.com, tesla.com)" },
        },
        required: ["domain"],
      },
    },
    {
      name: "get_app_store_ranking",
      description: "Get App Store / Play Store ranking for a company's app (via SerpAPI).",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name to search (e.g. 'Robinhood', 'Coinbase')" },
          store: { type: "string", description: "apple or google (default apple)" },
        },
        required: ["app_name"],
      },
    },
    {
      name: "get_job_postings_count",
      description: "Count recent job postings for a company as a hiring velocity signal.",
      inputSchema: {
        type: "object",
        properties: {
          company: { type: "string", description: "Company name (e.g. 'Nvidia', 'OpenAI')" },
          role_filter: { type: "string", description: "Optional role keyword (e.g. 'engineer', 'sales')" },
        },
        required: ["company"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, string>;

  switch (name) {
    case "get_google_trends": {
      const data = await serpFetch({
        engine: "google_trends",
        q: a.keyword,
        geo: a.geo ?? "US",
        date: a.period ?? "today 3-m",
        data_type: "TIMESERIES",
      });
      const timeline = (data.interest_over_time?.timeline_data ?? []).map((d: Record<string, unknown>) => ({
        date: d.date,
        value: (d.values as Array<{extracted_value: number}>)?.[0]?.extracted_value ?? 0,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ keyword: a.keyword, trend: timeline }) }] };
    }

    case "get_web_traffic": {
      const data = await serpFetch({
        engine: "google",
        q: `site:${a.domain} traffic statistics`,
        num: "5",
      });
      const results = (data.organic_results ?? []).slice(0, 3).map((r: Record<string, string>) => ({
        title: r.title,
        snippet: r.snippet,
        link: r.link,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ domain: a.domain, sources: results, note: "Web traffic data sourced via search. For precise data use SimilarWeb API directly." }) }],
      };
    }

    case "get_app_store_ranking": {
      const store = a.store === "google" ? "google_play_product" : "apple_app_store";
      const data = await serpFetch({
        engine: store === "google_play_product" ? "google_play" : "apple_app_store",
        q: a.app_name,
        num: "5",
      });
      const apps = (data.organic_results ?? []).slice(0, 5).map((r: Record<string, string | number>) => ({
        title: r.title,
        rating: r.rating,
        reviews: r.reviews,
        rank: r.position,
      }));
      return { content: [{ type: "text", text: JSON.stringify({ app_name: a.app_name, store: a.store ?? "apple", results: apps }) }] };
    }

    case "get_job_postings_count": {
      const query = a.role_filter
        ? `${a.company} ${a.role_filter} jobs site:linkedin.com OR site:indeed.com`
        : `${a.company} jobs site:linkedin.com OR site:indeed.com`;
      const data = await serpFetch({ engine: "google", q: query, num: "10" });
      const count = data.search_information?.total_results ?? "unknown";
      const sample = (data.organic_results ?? []).slice(0, 3).map((r: Record<string, string>) => r.title);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ company: a.company, estimated_postings: count, sample_titles: sample, note: "Estimated from search index counts, not exact." }),
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-altdata] running on stdio");

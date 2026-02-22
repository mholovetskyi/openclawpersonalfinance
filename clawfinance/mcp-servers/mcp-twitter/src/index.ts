import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY ?? "",
  appSecret: process.env.TWITTER_API_SECRET ?? "",
  accessToken: process.env.TWITTER_ACCESS_TOKEN ?? "",
  accessSecret: process.env.TWITTER_ACCESS_SECRET ?? "",
});
const readClient = client.readOnly;

const server = new Server({ name: "mcp-twitter", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_tweets",
      description: "Search recent tweets about a stock ticker or topic. Returns text, author, and engagement metrics.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (e.g. '$AAPL earnings' or 'Federal Reserve rate')" },
          max_results: { type: "number", description: "Max tweets (10–100, default 20)" },
          exclude_retweets: { type: "boolean", description: "Exclude retweets (default true)" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_user_tweets",
      description: "Get recent tweets from a specific financial account (e.g. @federalreserve, @elonmusk).",
      inputSchema: {
        type: "object",
        properties: {
          username: { type: "string", description: "Twitter username (without @)" },
          max_results: { type: "number", description: "Max tweets (5–100, default 10)" },
        },
        required: ["username"],
      },
    },
    {
      name: "get_sentiment_score",
      description: "Calculate sentiment score for a ticker based on recent tweet volume and engagement.",
      inputSchema: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "Stock ticker symbol (e.g. AAPL)" },
          hours: { type: "number", description: "Lookback hours (default 24)" },
        },
        required: ["ticker"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, string & number & boolean>;

  switch (name) {
    case "search_tweets": {
      const maxResults = Math.min(Math.max(Number(a.max_results ?? 20), 10), 100);
      const excludeRT = a.exclude_retweets !== false;
      const q = excludeRT ? `${a.query} -is:retweet` : a.query;

      const response = await readClient.v2.search(q, {
        max_results: maxResults,
        "tweet.fields": ["created_at", "public_metrics", "author_id"],
        expansions: ["author_id"],
        "user.fields": ["username", "name", "verified"],
      });

      const users = new Map(
        (response.includes?.users ?? []).map((u) => [u.id, { username: u.username, name: u.name }])
      );

      const tweets = (response.data?.data ?? []).map((t) => ({
        id: t.id,
        text: t.text,
        created_at: t.created_at,
        author: users.get(t.author_id ?? "") ?? { username: "unknown" },
        metrics: t.public_metrics,
      }));

      return { content: [{ type: "text", text: JSON.stringify({ query: a.query, count: tweets.length, tweets }) }] };
    }

    case "get_user_tweets": {
      const maxResults = Math.min(Math.max(Number(a.max_results ?? 10), 5), 100);
      const user = await readClient.v2.userByUsername(a.username, { "user.fields": ["id"] });
      if (!user.data) throw new Error(`User @${a.username} not found`);

      const timeline = await readClient.v2.userTimeline(user.data.id, {
        max_results: maxResults,
        "tweet.fields": ["created_at", "public_metrics"],
        exclude: ["retweets", "replies"],
      });

      const tweets = (timeline.data?.data ?? []).map((t) => ({
        id: t.id,
        text: t.text,
        created_at: t.created_at,
        metrics: t.public_metrics,
      }));

      return { content: [{ type: "text", text: JSON.stringify({ username: a.username, count: tweets.length, tweets }) }] };
    }

    case "get_sentiment_score": {
      const ticker = a.ticker.toUpperCase();
      const query = `$${ticker} -is:retweet lang:en`;

      const [bullResponse, bearResponse] = await Promise.all([
        readClient.v2.search(`${query} (bullish OR buy OR long OR calls OR moon OR pump)`, { max_results: 100, "tweet.fields": ["public_metrics"] }),
        readClient.v2.search(`${query} (bearish OR sell OR short OR puts OR dump OR crash)`, { max_results: 100, "tweet.fields": ["public_metrics"] }),
      ]);

      const bullTweets = bullResponse.data?.data ?? [];
      const bearTweets = bearResponse.data?.data ?? [];

      const engagementScore = (tweets: typeof bullTweets) =>
        tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count ?? 0) + (t.public_metrics?.retweet_count ?? 0) * 2, 0);

      const bullScore = engagementScore(bullTweets);
      const bearScore = engagementScore(bearTweets);
      const total = bullScore + bearScore;
      const sentimentRatio = total > 0 ? (bullScore - bearScore) / total : 0;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ticker,
            sentiment_score: Math.round(sentimentRatio * 100) / 100,
            sentiment_label: sentimentRatio > 0.2 ? "bullish" : sentimentRatio < -0.2 ? "bearish" : "neutral",
            bull_tweets: bullTweets.length,
            bear_tweets: bearTweets.length,
            bull_engagement: bullScore,
            bear_engagement: bearScore,
          }),
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-twitter] running on stdio");

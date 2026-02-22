import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import { readFileSync } from "node:fs";

const ENDPOINT = process.env.AZURE_DOC_INTEL_ENDPOINT!;
const KEY = process.env.AZURE_DOC_INTEL_KEY!;

if (!ENDPOINT || !KEY) {
  console.error("[mcp-azure-doc-intel] AZURE_DOC_INTEL_ENDPOINT and AZURE_DOC_INTEL_KEY required");
  process.exit(1);
}

const client = new DocumentAnalysisClient(ENDPOINT, new AzureKeyCredential(KEY));

const TAX_FORM_MODELS: Record<string, string> = {
  "W-2":       "prebuilt-tax.us.w2",
  "1099-INT":  "prebuilt-tax.us.1099Int",
  "1099-DIV":  "prebuilt-tax.us.1099Div",
  "1099-B":    "prebuilt-tax.us.1099B",
  "1099-MISC": "prebuilt-tax.us.1099Misc",
  "1040":      "prebuilt-tax.us.1040",
};

const server = new Server(
  { name: "mcp-azure-doc-intel", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_tax_document",
      description: "Extract structured data from a tax document (W-2, 1099-INT, 1099-DIV, 1099-B, 1099-MISC, 1040) using Azure Document Intelligence",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute path to the PDF/image file" },
          form_type: { type: "string", enum: ["W-2","1099-INT","1099-DIV","1099-B","1099-MISC","1040"], description: "Tax form type" },
        },
        required: ["file_path", "form_type"],
      },
    },
    {
      name: "analyze_document_url",
      description: "Extract structured data from a tax document at a URL",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string" },
          form_type: { type: "string", enum: ["W-2","1099-INT","1099-DIV","1099-B","1099-MISC","1040"] },
        },
        required: ["url", "form_type"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = args as Record<string, string>;
  const modelId = TAX_FORM_MODELS[a.form_type];
  if (!modelId) throw new Error(`Unsupported form_type: ${a.form_type}`);

  let poller;
  if (name === "analyze_tax_document") {
    const fileBuffer = readFileSync(a.file_path);
    poller = await client.beginAnalyzeDocument(modelId, fileBuffer, { contentType: "application/pdf" });
  } else if (name === "analyze_document_url") {
    poller = await client.beginAnalyzeDocumentFromUrl(modelId, a.url);
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }

  const result = await poller.pollUntilDone();
  const documents = result.documents ?? [];
  const extracted = documents.map(doc => ({
    docType: doc.docType,
    confidence: doc.confidence,
    fields: Object.fromEntries(
      Object.entries(doc.fields ?? {}).map(([k, v]) => [k, (v as any).value ?? (v as any).content])
    ),
  }));

  return { content: [{ type: "text", text: JSON.stringify({ form_type: a.form_type, documents: extracted }) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-azure-doc-intel] running on stdio");

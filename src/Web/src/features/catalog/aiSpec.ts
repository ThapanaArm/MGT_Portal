import { gatewayOrigin, isLiveEndpoint, GATEWAY_TOKEN_ID_HEADER, GATEWAY_TOKEN_SECRET_HEADER, CATEGORY_SPECS } from "@/features/catalog/gateway";
import type { CategoryDto, EndpointDto } from "@/shared/lib/types";

/**
 * Builds the copy-ready request examples and the "Copy for AI" text for catalog endpoints.
 * Everything here describes the real Gateway contract (token headers, Idempotency-Key, error shape),
 * so an AI assistant can write working code from it without guessing.
 */

export const IDEMPOTENCY_HEADER = "Idempotency-Key";
const GATEWAY_HEADERS = new Set([GATEWAY_TOKEN_ID_HEADER, GATEWAY_TOKEN_SECRET_HEADER, IDEMPOTENCY_HEADER].map((h) => h.toLowerCase()));

export const isWrite = (method: string) => method.toUpperCase() !== "GET";

/** Zoho modules the Gateway serves — the value goes into {module} (Zoho API name), resource is the scope part. */
export const ZOHO_MODULES = [
  { value: "Deals", label: "Deals", resource: "deal" },
  { value: "Quotes", label: "Quotes", resource: "quote" },
  { value: "Sales_Orders", label: "Sales Orders", resource: "order" },
] as const;
export type ZohoModule = (typeof ZOHO_MODULES)[number]["value"];
export const DEFAULT_ZOHO_MODULE: ZohoModule = "Deals";

/** Cards whose URL needs a Zoho module: {module} in the path, or ?module= for the field list. */
export const hasModuleChoice = (endpoint: EndpointDto) =>
  endpoint.path.startsWith("/zoho/") && (endpoint.path.includes("{module}") || endpoint.path === "/zoho/settings/fields");

const zohoModule = (module?: string) => ZOHO_MODULES.find((m) => m.value === module) ?? ZOHO_MODULES[0];

/** Zoho module named in the card's own path (/zoho/Quotes/...), or undefined for {module} / settings cards. */
export const pathModule = (endpoint: EndpointDto): ZohoModule | undefined =>
  ZOHO_MODULES.find((m) => endpoint.path === `/zoho/${m.value}` || endpoint.path.startsWith(`/zoho/${m.value}/`))?.value;

/** Module for examples: the one in the path, else the one picked on the card. */
const moduleFor = (endpoint: EndpointDto, module?: string) => pathModule(endpoint) ?? module;
const isZohoList = (endpoint: EndpointDto) => endpoint.path === "/zoho/{module}" || ZOHO_MODULES.some((m) => endpoint.path === `/zoho/${m.value}`);

/** Example request bodies per Zoho module — field names are Zoho standard ones; check yours with GET /zoho/settings/fields. */
const ZOHO_BODIES: Record<ZohoModule, { POST: unknown; PUT: unknown }> = {
  Deals: {
    POST: { data: [{ Deal_Name: "Rayong Auto Parts - Q4", Stage: "Qualification", Closing_Date: "2026-12-31", Account_Name: { id: "<account-id>" } }], trigger: ["workflow"] },
    PUT: { data: [{ Stage: "Closed Won" }] },
  },
  Quotes: {
    POST: { data: [{ Subject: "Q-2026-0101", Account_Name: { id: "<account-id>" }, Deal_Name: { id: "<deal-id>" }, Quoted_Items: [{ Product_Name: { id: "<product-id>" }, Quantity: 1000, List_Price: 208.6 }] }], trigger: ["workflow"] },
    PUT: { data: [{ Valid_Till: "2026-12-31" }] },
  },
  Sales_Orders: {
    POST: { data: [{ Subject: "SO-2026-0101", Account_Name: { id: "<account-id>" }, Quote_Name: { id: "<quote-id>" }, Ordered_Items: [{ Product_Name: { id: "<product-id>" }, Quantity: 1000, List_Price: 208.6 }] }], trigger: ["approval", "workflow"] },
    PUT: { data: [{ Due_Date: "2026-11-30" }] },
  },
};

const ZOHO_LIST_FIELDS: Record<ZohoModule, string> = {
  Deals: "Deal_Name,Stage,Account_Name,Closing_Date",
  Quotes: "Subject,Quote_Stage,Account_Name,Deal_Name",
  Sales_Orders: "Subject,Status,Account_Name,Quote_Name",
};

/** Scope for the chosen module, e.g. sales.{deal|quote|order}.create → sales.quote.create. */
export function resolvedScope(endpoint: EndpointDto, module?: string): string {
  return hasModuleChoice(endpoint) ? endpoint.scope.replace("{deal|quote|order}", zohoModule(module).resource) : endpoint.scope;
}

/** Example values for path placeholders, so the cURL can be pasted and run after adding a token. */
function examplePath(endpoint: EndpointDto, module?: string): string {
  if (endpoint.path.startsWith("/zoho/"))
    return endpoint.path.replace("{module}", zohoModule(moduleFor(endpoint, module)).value).replace("{id}", "6421337000000123456");
  const odata =
    endpoint.method === "GET"
      ? "A_SalesOrder('1000045')/to_Item"
      : endpoint.method === "PATCH"
        ? "A_SalesOrderItem(SalesOrder='1000045',SalesOrderItem='10')"
        : "A_SalesOrder('1000045')/to_Text";
  return endpoint.path
    .replace("{odataPath}", odata)
    .replace(/\{salesOrder\}|\{id\}/g, "1000045")
    .replace(/\{[^}]+\}/g, "1");
}

function exampleQuery(endpoint: EndpointDto, module?: string): string {
  if (endpoint.method !== "GET") return "";
  if (endpoint.path === "/zoho/settings/fields") return `?module=${zohoModule(module).value}`;
  if (endpoint.path.startsWith("/zoho/") && endpoint.path.endsWith("/search")) return "?criteria=(Account_Name:equals:Rayong Auto Parts)";
  if (isZohoList(endpoint)) return `?fields=${ZOHO_LIST_FIELDS[zohoModule(moduleFor(endpoint, module)).value]}&per_page=10`;
  if (endpoint.path.includes("{odataPath}")) return "?$select=SalesOrderItem,Material,RequestedQuantity";
  return endpoint.params.some((p) => p[0] === "limit" && p[1] === "query") ? "?limit=5" : "";
}

/** Pretty-prints JSON stored as text; returns the text unchanged when it is not JSON. */
export function prettyJson(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text.trim();
  }
}

/** The request body to show, or "" when the endpoint has none. */
export function requestBody(endpoint: EndpointDto, module?: string): string {
  if ((hasModuleChoice(endpoint) || pathModule(endpoint)) && (endpoint.method === "POST" || endpoint.method === "PUT"))
    return JSON.stringify(ZOHO_BODIES[zohoModule(moduleFor(endpoint, module)).value][endpoint.method], null, 2);
  const body = prettyJson(endpoint.reqBody);
  if (body) return body;
  return endpoint.path.endsWith("/cancel") ? "{}" : "";
}

export function gatewayUrl(category: CategoryDto, endpoint: EndpointDto, example = false, module?: string): string {
  const chosen = hasModuleChoice(endpoint) && module !== undefined;
  const path = example
    ? examplePath(endpoint, module) + exampleQuery(endpoint, module)
    : chosen
      ? endpoint.path.replace("{module}", zohoModule(module).value) + (endpoint.path === "/zoho/settings/fields" ? `?module=${zohoModule(module).value}` : "")
      : endpoint.path;
  return `${gatewayOrigin()}${category.basePath}${path}`;
}

/** cURL that works against the real Gateway once the token placeholders are filled in. */
export function buildCurl(category: CategoryDto, endpoint: EndpointDto, module?: string): string {
  const method = endpoint.method.toUpperCase();
  const lines = [`curl -X ${method} "${gatewayUrl(category, endpoint, true, module)}"`];
  lines.push(`  -H "${GATEWAY_TOKEN_ID_HEADER}: <token-id>"`);
  lines.push(`  -H "${GATEWAY_TOKEN_SECRET_HEADER}: <token-secret>"`);
  if (isWrite(method)) lines.push(`  -H "${IDEMPOTENCY_HEADER}: <new-uuid>"`);
  const body = requestBody(endpoint, module);
  if (body) {
    lines.push(`  -H "Content-Type: application/json"`);
    let compact = body.replace(/\s*\n\s*/g, " ");
    try {
      compact = JSON.stringify(JSON.parse(body));
    } catch {
      // not JSON — send the text as written
    }
    lines.push(`  -d '${compact.replace(/'/g, "'\\''")}'`);
  }
  return lines.join(" \\\n");
}

function statusLines(endpoint: EndpointDto): string[] {
  const method = endpoint.method.toUpperCase();
  const sap = endpoint.path.startsWith("/sap/");
  const zoho = endpoint.path.startsWith("/zoho/");
  const success = zoho ? (method === "POST" ? "201" : "200") :
    method === "GET" || endpoint.path.endsWith("/cancel") ? "200"
      : method === "POST" ? (sap ? "201 (SAP's created entity)" : "201")
        : sap ? "204 (no content)" : "200";
  const lines = [
    `- ${success}: success`,
    `- 400: invalid query or body${isWrite(method) ? `, or missing ${IDEMPOTENCY_HEADER}` : ""}${sap ? " (SAP's message is in `message`)" : zoho ? " (Zoho's error code is in `message`, the original error in `zoho`)" : ""}`,
    "- 401: missing or wrong Token ID / Secret",
    `- 403: the app has no access to this category${isWrite(method) ? ", or the record was not created by this app" : ""}`,
    "- 404: not found",
  ];
  if (isWrite(method)) {
    const system = zoho ? "Zoho" : "SAP";
    lines.push(`- 409: ${zoho ? "" : "changed in SAP meanwhile (ETag), or "}a request with this key is still running`);
    lines.push(`- 422: ${zoho ? "" : "SAP rejected the data, or "}the key was already used for a different request`);
    if (zoho) lines.push("- 429: Zoho API limit reached — wait and retry");
    lines.push(`- 502 / 504: ${system} failed or timed out — the change may already be saved; check ${system} before retrying with a new key`);
  } else {
    lines.push("- 502 / 504: the source system failed or timed out — safe to retry");
  }
  return lines;
}

/** Markdown for one endpoint — paste into Claude (or any AI) to get working code. */
export function buildEndpointMarkdown(category: CategoryDto, endpoint: EndpointDto, withRules = true, module?: string): string {
  const method = endpoint.method.toUpperCase();
  const live = isLiveEndpoint(category.key, method, endpoint.path);
  const out: string[] = [];
  out.push(`## ${endpoint.summary}`);
  out.push(`${method} ${gatewayUrl(category, endpoint)}`);
  out.push(`scope: ${endpoint.scope || "-"} · source: ${endpoint.sourcePlatform || "-"}${live ? "" : " · NOT AVAILABLE YET (documentation only)"}`);
  if (hasModuleChoice(endpoint)) {
    out.push(`module: one of ${ZOHO_MODULES.map((m) => m.value).join(" | ")} (Zoho API names, case as shown) — scope part: ${ZOHO_MODULES.map((m) => `${m.value} → ${m.resource}`).join(", ")}. Examples below use ${zohoModule(module).value}.`);
  }
  if (endpoint.description) out.push("", endpoint.description);

  if (withRules) out.push("", ...gatewayRules(category));
  else if (isWrite(method)) out.push("", `Requires header ${IDEMPOTENCY_HEADER} (new UUID per request; reuse it only when retrying the same request).`);

  const params = endpoint.params.filter((p) => !GATEWAY_HEADERS.has(p[0].toLowerCase()));
  if (params.length) {
    out.push("", "Parameters");
    for (const [name, location, type, required, description] of params) {
      out.push(`- ${name} (${location}, ${type}${required === "yes" ? ", required" : ""}): ${description}`);
    }
  }

  out.push("", "```bash", buildCurl(category, endpoint, module), "```");
  const body = requestBody(endpoint, module);
  if (body) out.push("", "Request body", "```json", body, "```");
  const response = prettyJson(endpoint.respExample);
  if (response && response !== "{}") out.push("", "Response example", "```json", response, "```");
  out.push("", "Status codes", ...statusLines(endpoint));
  return out.join("\n");
}

/** Shared rules for every Gateway call in a category. */
export function gatewayRules(category: CategoryDto): string[] {
  const specs = (CATEGORY_SPECS[category.key] ?? []).map((s) => `${s.label}: ${gatewayOrigin()}${s.path}`);
  return [
    "Rules (MGT Gateway)",
    `- Base URL: ${gatewayOrigin()}${category.basePath} — call it from your app's backend; never call SAP, Zoho or Supabase directly.`,
    `- Every request needs headers ${GATEWAY_TOKEN_ID_HEADER} and ${GATEWAY_TOKEN_SECRET_HEADER} (the ${category.name} token from the app's page in MGT Portal). A Sandbox token reaches test systems (SAP DEV, Zoho sandbox); a Production token reaches live data.`,
    `- Every POST / PUT / PATCH needs header ${IDEMPOTENCY_HEADER}: a new UUID per request; send the same value again only when retrying after a network error.`,
    "- Errors always come back as JSON: {\"message\": \"...\"}.",
    "- Apps can change or cancel only records (sales orders, deals, quotes) they created through the Gateway in the same environment.",
    "- /sap/... paths are SAP API_SALES_ORDER_SRV (OData V2) paths unchanged; responses are SAP's own JSON ({\"d\": ...}). DELETE and $batch are not available.",
    "- /zoho/... paths are Zoho CRM API v8 paths for Deals, Quotes and Sales_Orders; responses are Zoho's own JSON ({\"data\": [...], \"info\": {...}}). Write bodies are {\"data\": [ ... ]}. Use GET /zoho/settings/fields?module=Deals to learn field API names (Megachem has custom fields). No DELETE.",
    "- Sales orders created in Zoho go through Zoho's approval and are sent to SAP the usual way; /sap/... writes go to SAP directly (for apps that replace Zoho).",
    ...(specs.length ? ["- Full machine-readable list: " + specs.join(" · ")] : []),
  ];
}

/** Markdown for a whole category — "Copy all for AI". */
export function buildCategoryMarkdown(category: CategoryDto, endpoints: EndpointDto[]): string {
  const live = endpoints.filter((e) => isLiveEndpoint(category.key, e.method, e.path));
  const out = [
    `# MGT Gateway — ${category.name} APIs`,
    category.description,
    "",
    ...gatewayRules(category),
  ];
  for (const endpoint of live) out.push("", buildEndpointMarkdown(category, endpoint, false));
  return out.join("\n");
}

// Endpoints the Portal Gateway (backend Modules/Gateway) serves with real data today.
// Every other catalog entry is documentation with sample data only.
const LIVE_ENDPOINTS = new Set([
  "sales GET /orders",
  "sales POST /orders",
  "sales PATCH /orders/{salesOrder}",
  "sales POST /orders/{salesOrder}/cancel",
  // SAP API_SALES_ORDER_SRV passthrough (SapSalesOrderProxyController)
  "sales GET /sap/{odataPath}",
  "sales POST /sap/A_SalesOrder",
  "sales POST /sap/{odataPath}",
  "sales PATCH /sap/{odataPath}",
  // Zoho CRM Deals / Quotes / Sales_Orders (ZohoCrmProxyController)
  "sales GET /zoho/{module}",
  "sales GET /zoho/{module}/{id}",
  "sales GET /zoho/{module}/search",
  "sales GET /zoho/settings/fields",
  "sales POST /zoho/{module}",
  "sales PUT /zoho/{module}/{id}",
]);

/** Machine-readable specs per category, served by the Gateway without a token (for AI tools, MCP and Postman). */
export const CATEGORY_SPECS: Record<string, { label: string; path: string }[]> = {
  sales: [{ label: "SAP Sales Order OpenAPI", path: "/api/v1/specs/sales-order-sap.json" }],
};

/**
 * Catalog scopes are "category.resource.action" (sales.order.read) while Portal roles still grant
 * "category.read" / "category.write" — a role-level scope covers every resource in its category.
 */
export const hasCatalogScope = (hasScope: (scope: string) => boolean, scope: string) => {
  if (!scope || hasScope(scope)) return true;
  const parts = scope.split(".");
  if (parts.length < 3) return false;
  return hasScope(`${parts[0]}.${parts[parts.length - 1] === "read" ? "read" : "write"}`);
};

// Zoho cards name their module in the path (/zoho/Deals, /zoho/Quotes/{id}, /zoho/Sales_Orders/search ...).
const LIVE_ZOHO = /^sales (GET \/zoho\/(Deals|Quotes|Sales_Orders)(\/\{id\}|\/search)?|POST \/zoho\/(Deals|Quotes|Sales_Orders)|PUT \/zoho\/(Deals|Quotes|Sales_Orders)\/\{id\})$/;

export const isLiveEndpoint = (categoryKey: string, method: string, path: string) => {
  const key = `${categoryKey} ${method.toUpperCase()} ${path}`;
  return LIVE_ENDPOINTS.has(key) || LIVE_ZOHO.test(key);
};

export const GATEWAY_TOKEN_ID_HEADER = "X-Token-Id";
export const GATEWAY_TOKEN_SECRET_HEADER = "X-Token-Secret";

/** Request header rows for live endpoints: [header, value, required, description]. */
export const GATEWAY_HEADER_ROWS: string[][] = [
  [GATEWAY_TOKEN_ID_HEADER, "<token-id>", "yes", "Token ID from your application's API credentials"],
  [GATEWAY_TOKEN_SECRET_HEADER, "<token-secret>", "yes", "Token Secret from the same credential"],
];

export interface GatewayResult {
  status: number;
  ok: boolean;
  ms: number;
  body: unknown;
  url: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "";

/** Absolute origin the Gateway is served from (VITE_API_URL in builds that point elsewhere, otherwise this site). */
export const gatewayOrigin = () => (API_URL || window.location.origin).replace(/\/$/, "");

/**
 * Full URL of an endpoint as Swagger UI shows it — path parameters stay as {placeholders}.
 * Live endpoints point at the Gateway; the rest at the documented company API host for the chosen environment.
 */
export const endpointBaseUrl = (basePath: string, endpoint: { method: string; path: string }, categoryKey: string, host: string) =>
  isLiveEndpoint(categoryKey, endpoint.method, endpoint.path)
    ? `${gatewayOrigin()}${basePath}${endpoint.path}`
    : `https://${host}${basePath}${endpoint.path}`;

/** Query string from the Try-it inputs, skipping blanks — shared by the Request URL bar, cURL and the real call. */
export const buildQuery = (query: Record<string, string>) =>
  new URLSearchParams(Object.entries(query).filter(([, v]) => v.trim() !== "")).toString();

/**
 * Calls the Gateway directly with an application's Token ID/Secret.
 * Uses plain fetch (not the Portal api client) so a Gateway 401 does not sign the user out of the Portal.
 */
export async function callGateway(
  basePath: string,
  path: string,
  query: Record<string, string>,
  tokenId: string,
  tokenSecret: string,
): Promise<GatewayResult> {
  const qs = buildQuery(query);
  const url = `${API_URL}${basePath}${path}${qs ? `?${qs}` : ""}`;
  const started = performance.now();
  const res = await fetch(url, {
    headers: { [GATEWAY_TOKEN_ID_HEADER]: tokenId.trim(), [GATEWAY_TOKEN_SECRET_HEADER]: tokenSecret.trim() },
  });
  const ms = Math.round(performance.now() - started);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = { message: res.statusText };
  }
  return { status: res.status, ok: res.ok, ms, body, url: `${basePath}${path}${qs ? `?${qs}` : ""}` };
}

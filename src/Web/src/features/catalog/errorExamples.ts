import type { EndpointDto } from "@/shared/lib/types";

export interface RespTab {
  code: number;
  label: string;
  body: string;
}

export function buildRespTabs(e: EndpointDto): RespTab[] {
  const tabs: RespTab[] = [{ code: 200, label: "OK", body: e.respExample }];

  tabs.push({
    code: 401,
    label: "Unauthorized",
    body: '{\n  "error": "unauthorized",\n  "message": "The token is invalid, expired, or does not have the required scope"\n}',
  });

  if (e.path.includes("{id}")) {
    tabs.push({
      code: 404,
      label: "Not Found",
      body: '{\n  "error": "not_found",\n  "message": "No record found for the specified ID"\n}',
    });
  } else if (e.params.some((p) => p[3] === "yes")) {
    tabs.push({
      code: 400,
      label: "Bad Request",
      body: '{\n  "error": "validation_error",\n  "message": "The submitted data is incomplete or invalid"\n}',
    });
  }

  return tabs;
}

export function buildReqHeaders(method: string): [string, string, string, string][] {
  const rows: [string, string, string, string][] = [
    ["Authorization", "Bearer <token>", "required", "Token for authentication and authorization"],
  ];
  if (["POST", "PUT", "PATCH"].includes(method)) {
    rows.push(["Content-Type", "application/json", "required", "Request body format"]);
  }
  rows.push(["Accept", "application/json", "optional", "Preferred response format"]);
  return rows;
}

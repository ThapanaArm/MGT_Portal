import type { EndpointDto } from "./types";

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
    body: '{\n  "error": "unauthorized",\n  "message": "Token ไม่ถูกต้อง หมดอายุ หรือไม่มีสิทธิ์เข้าถึง scope นี้"\n}',
  });

  if (e.path.includes("{id}")) {
    tabs.push({
      code: 404,
      label: "Not Found",
      body: '{\n  "error": "not_found",\n  "message": "ไม่พบข้อมูลตาม id ที่ระบุ"\n}',
    });
  } else if (e.params.some((p) => p[3] === "yes")) {
    tabs.push({
      code: 400,
      label: "Bad Request",
      body: '{\n  "error": "validation_error",\n  "message": "ข้อมูลที่ส่งมาไม่ครบถ้วนหรือไม่ถูกต้อง"\n}',
    });
  }

  return tabs;
}

export function buildReqHeaders(method: string): [string, string, string, string][] {
  const rows: [string, string, string, string][] = [
    ["Authorization", "Bearer <token>", "required", "โทเคนสำหรับยืนยันตัวตนและตรวจสอบสิทธิ์"],
  ];
  if (["POST", "PUT", "PATCH"].includes(method)) {
    rows.push(["Content-Type", "application/json", "required", "รูปแบบข้อมูลของ request body"]);
  }
  rows.push(["Accept", "application/json", "optional", "รูปแบบข้อมูลที่ต้องการรับกลับ"]);
  return rows;
}

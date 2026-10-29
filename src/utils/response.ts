import type { ServerResponse } from "node:http";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export function sendSuccess<T>(
  response: ServerResponse,
  statusCode: number,
  data: T,
): void {
  sendJson(response, statusCode, { success: true, data });
}

export function sendError(
  response: ServerResponse,
  statusCode: number,
  message: string,
): void {
  sendJson(response, statusCode, { success: false, error: message });
}

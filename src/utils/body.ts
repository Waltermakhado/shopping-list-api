import type { IncomingMessage } from "node:http";
import { HttpError } from "./response";

export function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch {
        reject(new HttpError("Invalid JSON body", 400));
      }
    });
  });
}

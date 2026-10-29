import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Item } from "./models/item";

class RouteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

const port = 3000;
const items: Item[] = [];
let nextId = 1;

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch {
        reject(new RouteError("Invalid JSON body", 400));
      }
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const segments = new URL(request.url ?? "/", "http://localhost").pathname
      .split("/")
      .filter(Boolean);

    if (segments[0] !== "items" || segments.length < 1 || segments.length > 2) {
      throw new RouteError("Route not found", 404);
    }

    if (segments.length === 1 && request.method === "GET") {
      sendJson(response, 200, { success: true, data: items });
      return;
    }

    if (segments.length === 1 && request.method === "POST") {
      const body = await readJsonBody(request);
      if (!isRecord(body)) {
        throw new RouteError("Request body must be a JSON object", 400);
      }

      const { name, quantity, purchased } = body;
      if (typeof name !== "string" || name.trim().length === 0) {
        throw new RouteError("name must be a non-empty string", 400);
      }
      if (!Number.isInteger(quantity) || typeof quantity !== "number" || quantity <= 0) {
        throw new RouteError("quantity must be a positive integer", 400);
      }
      if (purchased !== undefined && typeof purchased !== "boolean") {
        throw new RouteError("purchased must be a boolean", 400);
      }

      const item: Item = {
        id: nextId++,
        name: name.trim(),
        quantity,
        purchased: purchased ?? false,
      };
      items.push(item);
      sendJson(response, 201, { success: true, data: item });
      return;
    }

    if (segments.length !== 2) {
      throw new RouteError("Method not allowed", 405);
    }

    const id = Number(segments[1]);
    if (!Number.isInteger(id) || id <= 0) {
      throw new RouteError("id must be a positive integer", 400);
    }

    if (request.method !== "GET" && request.method !== "PUT") {
      throw new RouteError("Method not allowed", 405);
    }

    const item = items.find((entry) => entry.id === id);
    if (!item) {
      throw new RouteError("Item not found", 404);
    }

    if (request.method === "GET") {
      sendJson(response, 200, { success: true, data: item });
      return;
    }

    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      throw new RouteError("Request body must be a JSON object", 400);
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasQuantity = Object.prototype.hasOwnProperty.call(body, "quantity");
    const hasPurchased = Object.prototype.hasOwnProperty.call(body, "purchased");
    if (!hasName && !hasQuantity && !hasPurchased) {
      throw new RouteError("At least one item field must be provided", 400);
    }
    const updates: Partial<Pick<Item, "name" | "quantity" | "purchased">> = {};

    if (hasName) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        throw new RouteError("name must be a non-empty string", 400);
      }
      updates.name = body.name.trim();
    }
    if (hasQuantity) {
      if (
        typeof body.quantity !== "number" ||
        !Number.isInteger(body.quantity) ||
        body.quantity <= 0
      ) {
        throw new RouteError("quantity must be a positive integer", 400);
      }
      updates.quantity = body.quantity;
    }
    if (hasPurchased) {
      if (typeof body.purchased !== "boolean") {
        throw new RouteError("purchased must be a boolean", 400);
      }
      updates.purchased = body.purchased;
    }

    Object.assign(item, updates);
    sendJson(response, 200, { success: true, data: item });
  } catch (error) {
    const statusCode = error instanceof RouteError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    sendJson(response, statusCode, { success: false, error: message });
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, () => {
  console.log(`Shopping List API is listening on port ${port}`);
});

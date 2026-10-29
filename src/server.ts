import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readBody } from "./utils/body";
import { HttpError, sendError, sendSuccess } from "./utils/response";
import type { Item } from "./models/item";

const port = 3000;
const items: Item[] = [];
let nextId = 1;

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
      throw new HttpError("Route not found", 404);
    }

    if (segments.length === 1 && request.method === "GET") {
      sendSuccess(response, 200, items);
      return;
    }

    if (segments.length === 1 && request.method === "POST") {
      const body = await readBody(request);
      if (!isRecord(body)) {
        throw new HttpError("Request body must be a JSON object", 400);
      }

      const { name, quantity, purchased } = body;
      if (typeof name !== "string" || name.trim().length === 0) {
        throw new HttpError("name must be a non-empty string", 400);
      }
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
        throw new HttpError("quantity must be a positive integer", 400);
      }
      if (purchased !== undefined && typeof purchased !== "boolean") {
        throw new HttpError("purchased must be a boolean", 400);
      }

      const item: Item = {
        id: nextId++,
        name: name.trim(),
        quantity,
        purchased: purchased ?? false,
      };
      items.push(item);
      sendSuccess(response, 201, item);
      return;
    }

    if (segments.length !== 2) {
      throw new HttpError("Method not allowed", 405);
    }

    const id = Number(segments[1]);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError("id must be a positive integer", 400);
    }

    if (
      request.method !== "GET" &&
      request.method !== "PUT" &&
      request.method !== "DELETE"
    ) {
      throw new HttpError("Method not allowed", 405);
    }

    const item = items.find((entry) => entry.id === id);
    if (!item) {
      throw new HttpError("Item not found", 404);
    }

    if (request.method === "GET") {
      sendSuccess(response, 200, item);
      return;
    }

    if (request.method === "DELETE") {
      items.splice(items.indexOf(item), 1);
      response.writeHead(204);
      response.end();
      return;
    }

    const body = await readBody(request);
    if (!isRecord(body)) {
      throw new HttpError("Request body must be a JSON object", 400);
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasQuantity = Object.prototype.hasOwnProperty.call(body, "quantity");
    const hasPurchased = Object.prototype.hasOwnProperty.call(body, "purchased");
    if (!hasName && !hasQuantity && !hasPurchased) {
      throw new HttpError("At least one item field must be provided", 400);
    }
    const updates: Partial<Pick<Item, "name" | "quantity" | "purchased">> = {};

    if (hasName) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        throw new HttpError("name must be a non-empty string", 400);
      }
      updates.name = body.name.trim();
    }
    if (hasQuantity) {
      if (
        typeof body.quantity !== "number" ||
        !Number.isInteger(body.quantity) ||
        body.quantity <= 0
      ) {
        throw new HttpError("quantity must be a positive integer", 400);
      }
      updates.quantity = body.quantity;
    }
    if (hasPurchased) {
      if (typeof body.purchased !== "boolean") {
        throw new HttpError("purchased must be a boolean", 400);
      }
      updates.purchased = body.purchased;
    }

    Object.assign(item, updates);
    sendSuccess(response, 200, item);
  } catch (error) {
    if (error instanceof HttpError) {
      sendError(response, error.statusCode, error.message);
      return;
    }

    console.error("Unexpected request error:", error);
    sendError(response, 500, "Internal server error");
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, () => {
  console.log(`Shopping List API is listening on port ${port}`);
});

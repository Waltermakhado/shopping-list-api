import { createServer } from "node:http";

const port = 3000;

const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ message: "Hello from the Shopping List API" }));
});

server.listen(port, () => {
  console.log(`Shopping List API is listening on port ${port}`);
});

import os from "node:os";
import http from "node:http";
import next from "next";
import { parse } from "node:url";

function getLocalAddresses() {
  const addresses = new Set(["localhost", "127.0.0.1"]);

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.add(entry.address);
      }
    }
  }

  return Array.from(addresses);
}

async function main() {
  const port = Number(process.env.PORT ?? "3000");
  const hostname = process.env.HOST ?? "0.0.0.0";
  const app = next({
    dev: false,
    dir: process.cwd(),
    hostname,
    port,
  });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    void handle(req, res, parsedUrl);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, resolve);
  });

  const addresses = getLocalAddresses();

  console.log(`next start listening on http://localhost:${port}`);

  for (const address of addresses) {
    if (address === "localhost" || address === "127.0.0.1") {
      continue;
    }

    console.log(`next start network on http://${address}:${port}`);
  }

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

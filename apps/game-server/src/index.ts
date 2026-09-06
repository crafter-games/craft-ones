import type { AddressInfo } from "node:net";
import { createGameServer } from "./server";

const port = Number(process.env.PORT ?? 2_567);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  throw new Error("PORT must be an integer between 0 and 65535");
}

const { server, httpServer } = createGameServer();
await server.listen(port, "0.0.0.0");
const address = httpServer.address() as AddressInfo;
console.info(
  `Craft Ones battle server ready at http://127.0.0.1:${address.port}/health`,
);

import { DiscordIdentity } from "../discord";
import { createGameServer } from "../server";

const apps = [
  {
    clientId: "111111111111111111",
    clientSecret: "fixture-secret",
    botToken: "fixture-bot",
  },
];
const users = [
  "222222222222222222",
  "333333333333333333",
  "444444444444444444",
];
const identity = new DiscordIdentity(apps, async (url, options) => {
  const path = new URL(String(url)).pathname;
  const token = new Headers(options?.headers)
    .get("Authorization")
    ?.replace("Bearer ", "");
  if (path.endsWith("/oauth2/token"))
    return Response.json({
      access_token: users.includes(
        String(new URLSearchParams(String(options.body)).get("code")),
      )
        ? String(new URLSearchParams(String(options.body)).get("code"))
        : users[0],
      refresh_token: "never-expose",
    });
  if (path.includes("activity-instances"))
    return Response.json({
      application_id: apps[0].clientId,
      instance_id: path.split("/").at(-1),
      users,
    });
  if (path.endsWith("/oauth2/@me"))
    return Response.json({
      application: {
        id: token === "wrong-app" ? "999999999999999999" : apps[0].clientId,
      },
      scopes: ["identify"],
    });
  return Response.json({ id: token === "wrong-app" ? users[0] : token });
});
const { server, httpServer } = createGameServer({
  discord: { apps, identity },
});
await server.listen(0, "127.0.0.1");
const address = httpServer.address();
if (address && typeof address === "object")
  console.log(`http://127.0.0.1:${address.port}`);

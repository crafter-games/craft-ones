// Trades the OAuth code the Discord client hands the Activity for an access token (the client secret stays here).
// POST /api/token {"code": "..."} -> {"access_token": "..."}. nginx forwards /api/token to this service.
const clientId = process.env.DISCORD_CLIENT_ID ?? "";
const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

Bun.serve({
  port: Number(process.env.PORT ?? 8788),
  async fetch(request): Promise<Response> {
    if (
      request.method !== "POST" ||
      new URL(request.url).pathname !== "/api/token"
    )
      return new Response("Not found", { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { code?: unknown };
    if (typeof body.code !== "string" || body.code === "")
      return new Response("Missing code", { status: 400 });
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: body.code,
      }),
    });
    const token = (await response.json()) as { access_token?: string };
    if (!response.ok || !token.access_token)
      return new Response("Discord refused the code", { status: 502 });
    return Response.json({ access_token: token.access_token });
  },
});

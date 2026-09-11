import { DiscordSDK } from "@discord/embedded-app-sdk";

export type DiscordSession = {
  sdk: DiscordSDK;
  accessToken: string;
  name: string;
};
let opening: Promise<DiscordSession> | undefined;
let sdk: DiscordSDK | undefined;

export function discordClientId() {
  return (
    /^(\d{17,20})\.discordsays\.com$/.exec(window.location.hostname)?.[1] ??
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
  );
}

export async function discordRequest(path: string, body: unknown) {
  const response = await fetch(`/game/discord/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Discord could not open this arena.");
  return result;
}

export function openDiscord() {
  if (opening) return opening;
  opening = (async () => {
    const clientId = discordClientId();
    if (!clientId)
      throw new Error("This Discord application is not configured yet.");
    sdk = new DiscordSDK(clientId, { disableConsoleLogOverride: true });
    const current = sdk;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        current.ready(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Discord did not respond. Close and reopen the Activity.",
                ),
              ),
            20000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    const { code } = await current.commands.authorize({
      client_id: clientId,
      response_type: "code",
      scope: ["identify"],
      prompt: "none",
    });
    const { access_token } = await discordRequest("token", { clientId, code });
    const auth = await current.commands.authenticate({ access_token });
    return {
      sdk: current,
      accessToken: access_token as string,
      name: auth.user.global_name ?? auth.user.username,
    };
  })().catch((error) => {
    sdk?.close(1000, "Authorization failed");
    sdk = undefined;
    opening = undefined;
    throw error;
  });
  return opening;
}

export function closeDiscord() {
  sdk?.close(1000, "Left the arena");
  sdk = undefined;
  opening = undefined;
}

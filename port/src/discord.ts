// Discord Activity entry: detects the embedded launch and completes the SDK handshake. The room for online play
// is the Activity instance id, so everyone in the same launch meets.
import { DiscordSDK } from "@discord/embedded-app-sdk";

const HANDSHAKE_TIMEOUT_MS = 20000;

export function isDiscordActivity(): boolean {
  const params = new URLSearchParams(location.search);
  return (
    /\.discordsays\.com$/.test(location.hostname) ||
    (params.has("frame_id") && params.has("instance_id"))
  );
}

// Discord serves the Activity from <client id>.discordsays.com; ?client_id= covers local tests.
function clientId(): string {
  const fromHost = /^(\d{17,20})\.discordsays\.com$/.exec(location.hostname);
  if (fromHost) return fromHost[1];
  return new URLSearchParams(location.search).get("client_id") ?? "";
}

export function showMessage(text: string): void {
  const box = document.createElement("div");
  box.textContent = text;
  box.style.cssText =
    "position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:#fff;font:600 18px system-ui;background:#1d1720";
  document.body.appendChild(box);
}

// Resolves with the Activity instance id once Discord acknowledges the Activity.
export async function startDiscord(): Promise<string> {
  const id = clientId();
  if (id === "") throw new Error("Missing the Discord client id.");
  const sdk = new DiscordSDK(id, { disableConsoleLogOverride: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      sdk.ready(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Discord did not respond. Close and reopen the Activity.",
              ),
            ),
          HANDSHAKE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  return sdk.instanceId;
}

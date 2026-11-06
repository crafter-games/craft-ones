// Discord Activity entry: detects the embedded launch, completes the SDK handshake and, in the background, signs
// the player in so the name plates can show real usernames and avatars. The room for online play is the Activity
// instance id, so everyone in the same launch meets.
import { DiscordSDK, Events } from "@discord/embedded-app-sdk";
import type { People, Person } from "./identity";

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

interface Raw {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string | null;
}
const person = (u: Raw): Person => ({
  id: u.id,
  username: u.username,
  discriminator: u.discriminator,
  avatar: u.avatar ?? "",
});

export interface DiscordSession {
  // The Activity instance id.
  instanceId: string;
  people: People;
}

// Resolves with the Activity instance id once Discord acknowledges the Activity. Sign-in and the participant list
// continue in the background: until they land, people.me() is "" and the game uses its plain labels.
export async function startDiscord(): Promise<DiscordSession> {
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
  const known = new Map<string, Person>();
  // Who is in the instance right now, by id.
  let present: string[] = [];
  let me = "";
  const remember = (list: Raw[]): void => {
    for (const u of list) known.set(u.id, person(u));
  };
  const participants = (list: Raw[]): void => {
    remember(list);
    present = list.map((u) => u.id);
  };
  // The participant list is Discord's own data about everyone in the instance. Asked again after sign-in, in case
  // the client only answers an authenticated app.
  const askParticipants = (): void => {
    sdk.commands
      .getInstanceConnectedParticipants()
      .then((r) => participants(r.participants))
      .catch((error) => console.warn("Discord participants failed", error));
  };
  askParticipants();
  sdk
    .subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, (e) =>
      participants(e.participants),
    )
    .catch(() => undefined);
  // Who this player is takes an OAuth round trip: authorize gives a code, the server (deploy/token.ts) trades it for
  // a token, and authenticate returns the user.
  (async (): Promise<void> => {
    const { code } = await sdk.commands.authorize({
      client_id: id,
      response_type: "code",
      state: "",
      scope: ["identify"],
    });
    const prefix = location.pathname.startsWith("/.proxy/") ? "/.proxy" : "";
    const response = await fetch(`${prefix}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const { access_token } = (await response.json()) as {
      access_token: string;
    };
    const auth = await sdk.commands.authenticate({ access_token });
    remember([auth.user]);
    me = auth.user.id;
    askParticipants();
  })().catch((error) => console.warn("Discord sign-in failed", error));
  return {
    instanceId: sdk.instanceId,
    people: {
      me: (): string => me,
      find: (u: string) => known.get(u) ?? null,
      rival: (): string => {
        const others = present.filter((u) => u !== me);
        return others.length === 1 ? others[0] : "";
      },
    },
  };
}

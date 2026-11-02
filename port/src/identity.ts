// Who is playing each seat, for the name plates only. Presentation: nothing here enters the simulation, the input
// words or the checksum, so peers that disagree on a name still play the same match.

export interface Plate {
  // The user id the plate was built for, "" while the seat has no name.
  id: string;
  // Exactly the Discord username.
  name: string;
}

// Indexed by seat: P1 is the relay's slot 0 (the host), P2 slot 1.
export const plates: Plate[] = [
  { id: "", name: "" },
  { id: "", name: "" },
];

// The texture key of a seat's avatar once it has loaded.
export const avatarKey = (seat: number): string => `avatar-${seat}`;

// What the session needs from Discord: the signed-in user's id and, for any user id, what Discord says about it.
export interface Person {
  id: string;
  username: string;
  // "0" for the current username system, a four digit tag on legacy accounts.
  discriminator: string;
  // Discord's avatar hash, or "" for the default avatar.
  avatar: string;
}

export interface People {
  me: () => string;
  find: (id: string) => Person | null;
}

// Usernames as Discord shows them: legacy accounts keep their tag.
export const displayName = (p: Person): string =>
  p.discriminator === "0" || p.discriminator === ""
    ? p.username
    : `${p.username}#${p.discriminator}`;

// The avatar path on cdn.discordapp.com, as a PNG at 64 px (dotframe decodes PNG only). Default avatars follow
// Discord's rule: the id picks one of six, legacy accounts use the tag modulo five.
export function avatarPath(p: Person): string {
  if (p.avatar !== "") return `avatars/${p.id}/${p.avatar}.png?size=64`;
  const index =
    p.discriminator === "0" || p.discriminator === ""
      ? Number((BigInt(p.id) >> 22n) % 6n)
      : Number(p.discriminator) % 5;
  return `embed/avatars/${index}.png`;
}

// A fixed list of people for local tests: "id:username,id:username", signed in as `me`.
export function stubPeople(spec: string, me: string): People {
  const known = new Map<string, Person>();
  for (const entry of spec.split(",")) {
    const at = entry.indexOf(":");
    if (at > 0)
      known.set(entry.slice(0, at), {
        id: entry.slice(0, at),
        username: entry.slice(at + 1),
        discriminator: "0",
        avatar: "",
      });
  }
  return { me: (): string => me, find: (id: string) => known.get(id) ?? null };
}

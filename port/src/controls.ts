// Keyboard, mouse and touch turned into one encoded input word, shared by the web and native entries. Aim follows
// the pointer only after it moves, so the keyboard keeps aiming when the mouse sits still. A press on the hotbar
// picks a slot instead of charging a shot.
import { type Input, Key, type Touch } from "dotframe/src/input";
import { aimBits, Bit, type Match, seatOf, shootBits, slotBits } from "./match";
import { hotbarSlots, screenToWorld, touchButtons } from "./render";

const BINDINGS: [number, number[]][] = [
  [Bit.Left, [Key.Left, Key.A]],
  [Bit.Right, [Key.Right, Key.D]],
  [Bit.Jump, [Key.Space, Key.W]],
  [Bit.AimUp, [Key.Up, Key.Q]],
  [Bit.AimDown, [Key.Down, Key.E]],
  [Bit.Fire, [Key.F, Key.Enter]],
  [Bit.Weapon, [Key.Tab, Key.X]],
  [Bit.Ability, [Key.C]],
  [Bit.Map, [Key.M]],
  [Bit.Restart, [Key.R]],
];
const SLOT_KEYS = [
  Key.Digit1,
  Key.Digit2,
  Key.Digit3,
  Key.Digit4,
  Key.Digit5,
  Key.Digit6,
  Key.Digit7,
];

// Pull length, in logical pixels, below which a slingshot does nothing and beyond which it is at full power.
const DEAD_ZONE = 18;
const FULL_PULL = 220;

export interface Controls {
  // The input for the seat with the turn.
  bits: (match: Match) => number;
  // True once a finger has touched the screen, so the renderer shows touch buttons.
  touched: () => boolean;
  // The slingshot's pending power while a finger pulls, for the renderer's preview.
  preview: () => number;
}

function inside(
  x: number,
  y: number,
  w: number,
  h: number,
  px: number,
  py: number,
): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

export function createControls(input: Input, W: number, H: number): Controls {
  let lastX = -1;
  let lastY = -1;
  let charging = false;
  let touched = false;
  let slingId = -1;
  let slingX = 0;
  let slingY = 0;
  let slingAngle = 0;
  let slingPower = 0;
  const slotAt = (px: number, py: number): number => {
    const slots = hotbarSlots(W, H);
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i];
      if (inside(r.x, r.y, r.size, r.size, px, py)) return i + 1;
    }
    return 0;
  };
  const pointerBits = (match: Match): number => {
    const seat = seatOf(match);
    if (seat < 0 || seat >= match.battle.state.players.length) return 0;
    const player = match.battle.state.players[seat];
    const aimAt = (px: number, py: number): number => {
      const world = screenToWorld(match, px, py);
      return aimBits(Math.atan2(world.y - player.y, world.x - player.x));
    };
    let bits = 0;
    const fingers = input.touches();
    if (fingers.length > 0) touched = true;
    let sling: Touch | null = null;
    for (const f of fingers) {
      const px = f.x * W;
      const py = f.y * H;
      if (f.id === slingId) {
        sling = f;
        continue;
      }
      let button = "";
      for (const b of touchButtons(H))
        if (button === "" && inside(b.x, b.y, b.w, b.h, px, py)) button = b.id;
      const slot = slotAt(px, py);
      if (button === "left") bits |= Bit.Left;
      else if (button === "right") bits |= Bit.Right;
      else if (button === "jump") bits |= Bit.Jump;
      else if (slot > 0) bits |= slotBits(slot);
      else if (slingId < 0) {
        // A new finger on the field starts the slingshot.
        slingId = f.id;
        slingX = px;
        slingY = py;
        sling = f;
      }
    }
    // Slingshot: pull back from where the finger landed; the shot flies the opposite way, and the pull length is
    // the power. Lifting the finger shoots; lifting inside the dead zone cancels.
    if (slingId >= 0) {
      if (sling) {
        const dx = slingX - sling.x * W;
        const dy = slingY - sling.y * H;
        const length = Math.hypot(dx, dy);
        slingAngle = Math.atan2(dy, dx);
        slingPower =
          length < DEAD_ZONE
            ? 0
            : Math.min(1, (length - DEAD_ZONE) / FULL_PULL);
        if (slingPower > 0) bits |= aimBits(slingAngle);
      } else {
        if (slingPower > 0) bits |= shootBits(slingAngle, slingPower);
        slingId = -1;
        slingPower = 0;
      }
    }
    // Once a finger has touched, the mouse is ignored: phones synthesize mouse events from touches, and that
    // pointer would overwrite the slingshot's aim on the release frame.
    if (touched) return bits;
    const p = input.pointer();
    const px = p.x * W;
    const py = p.y * H;
    const held = (p.buttons & 1) !== 0;
    if (!held) charging = false;
    else if (!charging) {
      const slot = slotAt(px, py);
      if (slot > 0) return slotBits(slot);
      charging = true;
    }
    const moved = px !== lastX || py !== lastY;
    lastX = px;
    lastY = py;
    if (moved && px >= 0 && px <= W && py >= 0 && py <= H)
      bits |= aimAt(px, py);
    if (charging) bits |= Bit.Fire | aimAt(px, py);
    return bits;
  };
  return {
    bits: (match: Match): number => {
      let bits = 0;
      for (const [bit, keys] of BINDINGS)
        for (const k of keys) if (input.down(k)) bits |= bit;
      for (let i = 0; i < SLOT_KEYS.length; i++)
        if (input.down(SLOT_KEYS[i])) bits |= slotBits(i + 1);
      return bits | pointerBits(match);
    },
    touched: (): boolean => touched,
    preview: (): number => slingPower,
  };
}

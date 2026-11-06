// Keyboard, mouse and touch turned into one encoded input word, shared by the web and native entries. Aim follows
// the pointer only after it moves, so the keyboard keeps aiming when the mouse sits still. A press on the hotbar
// picks a slot instead of shooting. Mouse and touch shoot with a slingshot (press, pull back, let go); F and Enter
// charge with the swinging meter.
import { type Input, Key, type Touch } from "dotframe/src/input";
import {
  aimBits,
  Bit,
  type Match,
  power01,
  seatOf,
  shootBits,
  slotBits,
} from "./match";
import { hotbarSlots, menuButton, screenToWorld, touchButtons } from "./render";

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

// A slingshot being pulled, in logical pixels: from where the press landed to where the pointer is now.
export interface Drag {
  active: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  power: number;
}

// Pull length, in logical pixels, below which a slingshot does nothing and beyond which it is at full power.
const DEAD_ZONE = 18;
const FULL_PULL = 220;

export interface Controls {
  // The input for the seat with the turn.
  bits: (match: Match) => number;
  // True once a finger has touched the screen, so the renderer shows touch buttons.
  touched: () => boolean;
  // The slingshot's pending power while a finger or the mouse pulls, for the renderer's preview.
  preview: () => number;
  // The slingshot being pulled right now, for the drag line.
  drag: () => Drag;
  // The power of a seat's last shot from this device (-1 before the first), for the marker on the power bar.
  last: (seat: number) => number;
  // Ignore the pointer until it lifts (call while a menu owns it, so the tap that starts a match does not shoot).
  disarm: () => void;
  // True once after the MENU button on the results card was tapped or clicked.
  menu: () => boolean;
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
  let touched = false;
  let slingId = -1;
  let slingX = 0;
  let slingY = 0;
  let slingAngle = 0;
  let slingPower = 0;
  let menuTapped = false;
  // The mouse slingshot: pressed on the field, dragged back, released to shoot.
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let mouseAngle = 0;
  let mousePower = 0;
  const pulled: Drag = {
    active: false,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    power: 0,
  };
  const lastPower = [-1, -1];
  let keyFire = false;
  // Power from a pull of `length` logical pixels.
  const pullPower = (length: number): number =>
    length < DEAD_ZONE ? 0 : Math.min(1, (length - DEAD_ZONE) / FULL_PULL);
  // The click or tap that started the match is still held on its first frames; ignore the pointer until it lifts.
  let armed = false;
  const slotAt = (px: number, py: number): number => {
    const slots = hotbarSlots(W, H);
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i];
      if (inside(r.x, r.y, r.size, r.size, px, py)) return i + 1;
    }
    return 0;
  };
  const pointerBits = (match: Match): number => {
    // After the match, the MENU button goes back to setup; any other tap or click asks for a rematch.
    if (match.battle.state.phase === "finished") {
      const t = input.touches();
      const p = input.pointer();
      const down = t.length > 0 || (p.buttons & 1) !== 0;
      const x = (t.length > 0 ? t[0].x : p.x) * W;
      const y = (t.length > 0 ? t[0].y : p.y) * H;
      const b = menuButton(W);
      const onMenu = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      if (down && onMenu) menuTapped = true;
      return down && !onMenu ? Bit.Restart : 0;
    }
    const seat = seatOf(match);
    pulled.active = false;
    if (seat < 0 || seat >= match.battle.state.players.length) return 0;
    const player = match.battle.state.players[seat];
    const aimAt = (px: number, py: number): number => {
      const world = screenToWorld(match, px, py);
      return aimBits(Math.atan2(world.y - player.y, world.x - player.x)); // dotframe-allow-math
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
      else if (button === "map") bits |= Bit.Map;
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
        const length = Math.hypot(dx, dy); // dotframe-allow-math
        slingAngle = Math.atan2(dy, dx); // dotframe-allow-math
        slingPower = pullPower(length);
        if (slingPower > 0) bits |= aimBits(slingAngle);
        pulled.active = true;
        pulled.fromX = slingX;
        pulled.fromY = slingY;
        pulled.toX = sling.x * W;
        pulled.toY = sling.y * H;
        pulled.power = slingPower;
      } else {
        if (slingPower > 0) {
          bits |= shootBits(slingAngle, slingPower);
          lastPower[seat] = slingPower;
        }
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
    // Mouse slingshot, like the finger: press on the field, pull back away from where the shot should go, and
    // let go. The pull length is the power, so moving back toward the press lowers it; letting go inside the dead
    // zone cancels.
    if (held && !mouseDown) {
      const slot = slotAt(px, py);
      if (slot > 0) return slotBits(slot);
      mouseDown = true;
      mouseX = px;
      mouseY = py;
      mousePower = 0;
    }
    if (mouseDown && held) {
      const dx = mouseX - px;
      const dy = mouseY - py;
      mouseAngle = Math.atan2(dy, dx); // dotframe-allow-math
      mousePower = pullPower(Math.hypot(dx, dy)); // dotframe-allow-math
      if (mousePower > 0) bits |= aimBits(mouseAngle);
      pulled.active = true;
      pulled.fromX = mouseX;
      pulled.fromY = mouseY;
      pulled.toX = px;
      pulled.toY = py;
      pulled.power = mousePower;
      lastX = px;
      lastY = py;
      return bits;
    }
    if (mouseDown) {
      mouseDown = false;
      if (mousePower > 0) {
        bits |= shootBits(mouseAngle, mousePower);
        lastPower[seat] = mousePower;
      }
      mousePower = 0;
      return bits;
    }
    // Not pulling: the barrel follows the pointer once it moves.
    const moved = px !== lastX || py !== lastY;
    lastX = px;
    lastY = py;
    if (moved && px >= 0 && px <= W && py >= 0 && py <= H)
      bits |= aimAt(px, py);
    return bits;
  };
  return {
    bits: (match: Match): number => {
      let bits = 0;
      for (const [bit, keys] of BINDINGS)
        for (const k of keys) if (input.down(k)) bits |= bit;
      for (let i = 0; i < SLOT_KEYS.length; i++)
        if (input.down(SLOT_KEYS[i])) bits |= slotBits(i + 1);
      // A keyboard charge (F or Enter) lets go: remember its power for the marker.
      const fire = (bits & Bit.Fire) !== 0;
      const seat = seatOf(match);
      if (keyFire && !fire && seat >= 0 && match.charge[seat] > 0)
        lastPower[seat] = power01(match.charge[seat]);
      keyFire = fire;
      if (!armed)
        armed =
          input.touches().length === 0 && (input.pointer().buttons & 1) === 0;
      return armed ? bits | pointerBits(match) : bits;
    },
    touched: (): boolean => touched,
    preview: (): number => slingPower || mousePower,
    drag: (): Drag => pulled,
    last: (seat: number): number =>
      seat >= 0 && seat < 2 ? lastPower[seat] : -1,
    disarm: (): void => {
      armed = false;
    },
    menu: (): boolean => {
      const tapped = menuTapped;
      menuTapped = false;
      return tapped;
    },
  };
}

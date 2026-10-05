// Drives the setup screen from the keyboard, the mouse and touch, on every target. Edges only: one press, one move.
import { type Input, Key } from "dotframe/src/input";
import {
  press,
  type Setup,
  type SetupChoice,
  type SetupKey,
  tap,
} from "./setup";

const SETUP_KEYS: [SetupKey, number[]][] = [
  ["up", [Key.Up, Key.W]],
  ["down", [Key.Down, Key.S]],
  ["left", [Key.Left, Key.A]],
  ["right", [Key.Right, Key.D]],
  ["confirm", [Key.Enter, Key.Space, Key.F]],
];

export interface SetupInput {
  // The player's choice this frame, if they started a match.
  poll: (setup: Setup, W: number, H: number) => SetupChoice | null;
  // A key that went down this frame (Escape and the like, outside setup).
  tapped: (keys: number[]) => boolean;
}

export function createSetupInput(input: Input): SetupInput {
  const held = new Set<number>();
  let mouseWas = false;
  let fingerWas = false;
  const tapped = (keys: number[]): boolean => {
    let down = false;
    let was = false;
    for (const k of keys) {
      if (held.has(k)) was = true;
      if (input.down(k)) {
        down = true;
        held.add(k);
      } else held.delete(k);
    }
    return down && !was;
  };
  return {
    tapped,
    poll: (setup: Setup, W: number, H: number): SetupChoice | null => {
      for (const [key, keys] of SETUP_KEYS)
        if (tapped(keys)) {
          const options = press(setup, key);
          if (options) return { mode: "local", options };
        }
      // A tap counts when the finger lands; a click when the button goes down.
      const fingers = input.touches();
      const finger = fingers.length > 0;
      if (finger && !fingerWas) {
        fingerWas = true;
        return tap(setup, fingers[0].x * W, fingers[0].y * H, W, H);
      }
      fingerWas = finger;
      const p = input.pointer();
      const mouse = (p.buttons & 1) !== 0;
      const pressed = mouse && !mouseWas;
      mouseWas = mouse;
      return pressed ? tap(setup, p.x * W, p.y * H, W, H) : null;
    },
  };
}

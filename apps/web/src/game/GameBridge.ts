import type { BattleView, FireAction, WeaponId } from "@craft-ones/shared";
export type GameBridge = {
  state: BattleView | null;
  sessionId: string;
  connected: boolean;
  generation: number;
  showTrajectory: boolean;
  debug: boolean;
  weapon: WeaponId;
  abilityAim: boolean;
  focus: boolean;
  sound: boolean;
  suspended: boolean;
  paused: boolean;
  ready: boolean;
  movementDirection: -1 | 0 | 1;
  /** Screen-space edges the HUD covers, which the camera frames around. */
  hudInsets: { top: number; bottom: number; left: number; right: number };
  direction: -1 | 1;
  jump: (direction?: -1 | 0 | 1) => void;
  ability: (aim?: { angle: number; power: number }) => void;
  fire: (action: FireAction) => void;
  move: (direction: -1 | 1) => void;
  charge: (power: number) => void;
};
export function createBridge(charge: GameBridge["charge"]): GameBridge {
  return {
    state: null,
    sessionId: "",
    connected: false,
    generation: 0,
    showTrajectory: true,
    debug: false,
    weapon: "rocket",
    abilityAim: false,
    focus: false,
    sound: true,
    suspended: false,
    paused: false,
    ready: false,
    movementDirection: 0,
    hudInsets: { top: 0, bottom: 0, left: 0, right: 0 },
    direction: 1,
    jump: () => {},
    ability: () => {},
    fire: () => {},
    move: () => {},
    charge,
  };
}

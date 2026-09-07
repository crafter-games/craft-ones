import type { BattleView, FireAction, WeaponId } from "@craft-ones/shared";
export type GameBridge = {
  state: BattleView | null;
  sessionId: string;
  connected: boolean;
  generation: number;
  showTrajectory: boolean;
  debug: boolean;
  weapon: WeaponId;
  focus: boolean;
  direction: -1 | 1;
  jump: () => void;
  ability: () => void;
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
    focus: false,
    direction: 1,
    jump: () => {},
    ability: () => {},
    fire: () => {},
    move: () => {},
    charge,
  };
}

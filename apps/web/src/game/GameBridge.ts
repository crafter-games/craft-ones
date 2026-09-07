import type { BattleView, FireAction } from "@craft-ones/shared";
export type GameBridge = {
  state: BattleView | null;
  sessionId: string;
  connected: boolean;
  generation: number;
  showTrajectory: boolean;
  debug: boolean;
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
    fire: () => {},
    move: () => {},
    charge,
  };
}

import { EngineState } from "./engine";
import { GameState } from "./game";

type Recording = { engine: EngineState; game: GameState };
declare global {
  interface Window {
    game: any;
    gameState: GameState;
    engineState: EngineState;
    recordings: Recording[];
  }
  const game: any;
  const gameState: GameState;
  const engineState: EngineState;
}

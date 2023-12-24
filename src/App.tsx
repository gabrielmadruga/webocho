import { useEffect } from "react";
import * as game from "./game";

function App() {
  useEffect(function startTheGame() {
    if (window.game) return;
    window.game = game;
    // Give it half a second to start. Was getting a slowdown at the start otherwise
    setTimeout(game.start, 500);
  }, []);

  return (
    <div className="App">
      <canvas id="canvas"></canvas>
    </div>
  );
}

export default App;

// Old code for an attempt of input handling for mobile, left for later
/*
<div className="Controls">
<div className="Joystick">
  <button
    onTouchStart={handleButtonTouch}
    onTouchMove={handleButtonTouch}
    onTouchEnd={handleButtonTouch}
  >
    J
  </button>
</div>
<div className="Buttons">
  <button
    onTouchStart={handleButtonTouch}
    onTouchEnd={handleButtonTouch}
  >
    Z
  </button>
  <button
    onTouchStart={handleButtonTouch}
    onTouchEnd={handleButtonTouch}
  >
    X
  </button>
</div>
</div>
*/
// const handleButtonTouch: TouchEventHandler<HTMLButtonElement> = useCallback(
//   (event) => {
//     const key = (event.target as HTMLButtonElement).innerText;
//     if (key === "J") {
//       if (event.type === "touchend") {
//         const moveButtonKeys = [
//           "ArrowLeft",
//           "ArrowRight",
//           "ArrowUp",
//           "ArrowDown",
//         ];
//         moveButtonKeys.forEach(
//           (key) => (window.engineState.buttons[key] = false)
//         );
//       } else {
//         const boundingRect = (
//           event.target as HTMLButtonElement
//         ).getBoundingClientRect();
//         const x = event.touches[0].clientX - boundingRect.left;
//         const y = event.touches[0].clientY - boundingRect.top;
//         if (x < boundingRect.width / 3) {
//           window.engineState.buttons["ArrowLeft"] = true;
//         } else if (x > (2 * boundingRect.width) / 3) {
//           window.engineState.buttons["ArrowRight"] = true;
//         } else {
//           ["ArrowLeft", "ArrowRight"].forEach(
//             (key) => (window.engineState.buttons[key] = false)
//           );
//         }
//         if (y < boundingRect.height / 3) {
//           window.engineState.buttons["ArrowUp"] = true;
//         } else if (y > (2 * boundingRect.height) / 3) {
//           window.engineState.buttons["ArrowDown"] = true;
//         } else {
//           ["ArrowUp", "ArrowDown"].forEach(
//             (key) => (window.engineState.buttons[key] = false)
//           );
//         }
//       }
//     } else {
//       window.engineState.buttons[`Key${key}`] = event.type === "touchstart";
//     }
//   },
//   []
// );

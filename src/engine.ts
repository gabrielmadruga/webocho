const max = Math.max;
const min = Math.min;
function mid(x: number, y: number, z: number) {
  if (x > y) {
    // y, x
    if (y > z) {
      // z, y, x
      return y;
    } else if (x > z) {
      // y, z, x
      return z;
    } else {
      return x; // y, x, z
    }
  } else {
    // x, y
    if (x > z) {
      // z, x, y
      return x;
    } else if (y > z) {
      // x, z, y
      return z;
    } else {
      // x, y, z
      return y;
    }
  }
}
function clamp(n: number, low: number, high: number) {
  let result = n;
  if (n < low) {
    result = low;
  } else if (n > high) {
    result = high;
  }
  return result;
}
const flr = Math.floor;
function round(x: number) {
  return flr(x + 0.5);
}
const ceil = Math.ceil;
const sqrt = Math.sqrt;
const abs = Math.abs;
const cos = (n: number) => Math.cos(n * 2 * Math.PI);
const sin = (n: number) => -Math.sin(n * 2 * Math.PI);
const sign = (v: number) => Math.sign(v);

// (inclusive of 0, but not x)
function rnd(x = 1) {
  return Math.random() * x;
}

function rndf(l: number, h: number) {
  return l + rnd(h - l);
}

function rndi(l: number, h: number) {
  return flr(rndf(l, h + 1));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/// Useful for negative numbers...
function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

//////////////////////////////
// vectors
//////////////////////////////

type Vec = readonly [number, number] & {
  readonly x: number;
  readonly y: number;
};
function v(x: number | [number, number], y?: number): Vec {
  if (Array.isArray(x)) {
    if (x.length !== 2) throw new Error("invalid array size for V2");
    const result = [...x] as [number, number] & { x: number; y: number };
    result.x = x[0];
    result.y = x[1];
    return result;
  } else if (y !== undefined) {
    const result = [x, y] as [number, number] & { x: number; y: number };
    result.x = x;
    result.y = y;
    return result;
  } else {
    throw new Error("missing parameter y in V2");
  }
}

function vma(magnitude: number, angle: number) {
  return v(cos(angle) * magnitude, sin(angle) * magnitude);
}

function v_add(v1: Vec, v2: Vec) {
  return v([v1.x + v2.x, v1.y + v2.y]);
}
function v_sub(v1: Vec, v2: Vec) {
  return v(v1.x - v2.x, v1.y - v2.y);
}
function v_mul(v1: Vec, m: number) {
  // or scale
  return v(v1.x * m, v1.y * m);
}
function v_div(v1: Vec, d: number) {
  return v(v1.x / d, v1.y / d);
}
function v_neg(v1: Vec) {
  // or unary minus
  return v(-v1.x, -v1.y);
}
// dot product
function v_dot(v1: Vec, v2: Vec) {
  return v1.x * v2.x + v1.y * v2.y;
}
// normalization
function v_norm(v1: Vec) {
  const len = sqrt(v1.x * v1.x + v1.y * v1.y);
  return v(v1.x / len, v1.y / len);
}
// rotation
function v_rotr(v1: Vec) {
  return v(-v1.y, v1.x);
}

function v_lensq(v1: Vec) {
  return v1.x * v1.x + v1.y * v1.y;
}
function v_len(v1: Vec) {
  return sqrt(v1.x * v1.x + v1.y * v1.y);
}

function v_str(v1: Vec) {
  return `v(${v1.x}, ${v1.y})`;
}

function v_lerp(a: Vec, b: Vec, t: number) {
  return v_add(a, v_mul(v_sub(b, a), t));
}

const enum Color {
  Black,
  DarkBlue,
  DarkPurple,
  DarkGreen,
  Brown,
  DarkGray,
  LightGray,
  White,
  Red,
  Orange,
  Yellow,
  Green,
  Blue,
  Indigo,
  Pink,
  Peach,
}
//     "#000000",
//     "#1d2b53",
//     "#7e2553",
//     "#008751",
//     "#ab5236",
//     "#5f574f",
//     "#c2c3c7",
//     "#fff1e8",
//     "#ff004d",
//     "#ffa300",
//     "#ffec27",
//     "#00e436",
//     "#29adff",
//     "#83769c",
//     "#ff77a8",
//     "#ffccaa"

function palCreate() {
  const result: Color[] = [];
  for (let i = 0; i < ColorsRGB.length; i++) {
    result.push(i);
  }
  return result;
}

const ColorsRGB = [
  [0, 0, 0],
  [29, 43, 83],
  [126, 37, 83],
  [0, 135, 81],
  [171, 82, 54],
  [95, 87, 79],
  [194, 195, 199],
  [255, 241, 232],
  [255, 0, 77],
  [255, 163, 0],
  [255, 236, 39],
  [0, 228, 54],
  [41, 173, 255],
  [131, 118, 156],
  [255, 119, 168],
  [255, 204, 170],
];

export type EngineState = {
  camera: { x: number; y: number };
  drawPaletteRemap: Color[];
  transparentColors: boolean[];
  displayPaletteRemap: Color[];
  buttons: Record<string, boolean>;
  updateCount: number;
};

window.engineState = {
  camera: { x: 0, y: 0 },
  drawPaletteRemap: palCreate(),
  transparentColors: [true, ...Array(ColorsRGB.length - 1).fill(false)],
  displayPaletteRemap: palCreate(),
  buttons: {},
  updateCount: 0,
};

let canvas: HTMLCanvasElement;
let canvasCtx: CanvasRenderingContext2D | null;
let bufferCanvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D | null;
let bufferImageData: ImageData;
let pixelBuffer: Uint8ClampedArray;
const pixelStride = 4;
const lineStride = pixelStride * 128;
const spriteSizePx = 8;

let audioCtx: AudioContext | null;
let musicBufferSourceNode: AudioBufferSourceNode | null;
let musicGainNode: GainNode | null;
const targetFPS = 30;
const msPerFrame = 1000 / targetFPS;
let loadingState:
  | "Downloading assets"
  | "Waiting for user input"
  | "Decoding audio files" = "Downloading assets";

type SfxName = (typeof sfxNames)[number];
type Assets = {
  fontPixels: Uint8ClampedArray;
  spritesPixels: Uint8ClampedArray;
  sfxs: Map<SfxName, AudioBuffer>;
  undecodedSfxs: ArrayBuffer[];
};
let assets: Assets | undefined;

async function start() {
  canvas = document.getElementById("canvas") as HTMLCanvasElement;
  canvas.width = 128;
  canvas.height = 128;
  // canvas.style.width = `${128 * 4}px`;
  // canvas.style.height = `${128 * 4}px`;
  canvasCtx = canvas.getContext("2d");
  if (!canvasCtx) throw new Error("Failed to _canvas.getContext");

  bufferCanvas = document.createElement("canvas");
  bufferCanvas.width = 128;
  bufferCanvas.height = 128;
  ctx = bufferCanvas.getContext("2d");
  if (!ctx) throw new Error("Failed to _bufferCanvas.getContext");
  bufferImageData = ctx.getImageData(
    0,
    0,
    bufferCanvas.width,
    bufferCanvas.height
  );
  pixelBuffer = bufferImageData.data;

  loadAssets(function onLoadAssetsProgress(progressEvent) {
    const type = progressEvent.type;
    if (type === "user-input" && progressEvent.loaded == 0) {
      loadingState = "Waiting for user input";
    } else if (type === "audio-decoding" && progressEvent.loaded === 0) {
      loadingState = "Decoding audio files";
    }
  }).then((loadedAssets) => {
    assets = loadedAssets;
    game.init();
  });

  setInterval(loop, msPerFrame);
}

function loop() {
  const currentTime = performance.now();

  if (!assets) {
    // The font may be already downloaded but we wait for all assets to load...
    // so we can't use print here yet
    if (canvasCtx) {
      canvasCtx.fillStyle = "black";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      canvasCtx.fillStyle = "white";
      canvasCtx.textAlign = "center";
      canvasCtx.font = "12px Arial";
      canvasCtx.textBaseline = "middle";
      canvasCtx.fillText(loadingState, canvas.width / 2, canvas.height / 2);
    }
  } else {
    game.update();
    engineState.updateCount += 1;
    game.draw();
  }

  applyDisplayPaletteRemapping();
  ctx?.putImageData(bufferImageData, 0, 0);
  canvasCtx?.drawImage(bufferCanvas, 0, 0, canvas.width, canvas.height);

  const elapsedTime = performance.now() - currentTime;
  const unusedTime = msPerFrame - elapsedTime;
  if (unusedTime < 1)
    console.error(
      `Taking too much time 😱 unused time was ${unusedTime.toFixed(2)}`
    );
}

async function loadAssets(
  progressCallback?: (event: {
    type: string;
    total: number;
    loaded: number;
    startTimeMs: number;
    lastTimeMs: number;
  }) => void
) {
  const defaultStartTime = performance.now();
  const createProgressCallbackForType =
    (type: string) =>
    (event: { total: number; loaded: number; startTimeMs?: number }) =>
      progressCallback?.({
        type,
        total: event.total,
        loaded: event.loaded,
        startTimeMs: event.startTimeMs || defaultStartTime,
        lastTimeMs: performance.now(),
      });
  const audioPC = createProgressCallbackForType("audio");
  const fontPC = createProgressCallbackForType("font");
  const spritesPC = createProgressCallbackForType("sprites");
  const mapPC = createProgressCallbackForType("map");
  const flagPC = createProgressCallbackForType("flag");
  const userInputPC = createProgressCallbackForType("user-input");
  const audioDecPC = createProgressCallbackForType("audio-decoding");

  const loadAudioPromise = loadAudio(audioPC);
  const data = await Promise.all([
    loadImageData(`assets/font.png`, fontPC),
    loadImageData(`assets/sprites.png`, spritesPC),
    loadAudioPromise,
    loadMap(mapPC),
    loadSpriteFlags(flagPC),
  ]);
  const assets: Assets = {
    fontPixels: data[0].data,
    spritesPixels: data[1].data,
    undecodedSfxs: data[2],
    sfxs: new Map(),
  };
  const userInputWaitStart = performance.now();
  userInputPC({
    loaded: 0,
    total: 1,
    startTimeMs: userInputWaitStart,
  });
  await userInteractionHappenedPromise;
  userInputPC({
    loaded: 1,
    total: 1,
    startTimeMs: userInputWaitStart,
  });
  const audioDecodingStartTime = performance.now();
  audioDecPC({
    loaded: 0,
    total: 1,
    startTimeMs: audioDecodingStartTime,
  });
  const sfxs = await Promise.all(
    assets.undecodedSfxs.flatMap((s) => audioCtx?.decodeAudioData(s) ?? [])
  );
  for (let i = 0; i < sfxNames.length; i++) {
    const name = sfxNames[i];
    assets.sfxs.set(name, sfxs[i]);
  }
  audioDecPC({
    loaded: 1,
    total: 1,
    startTimeMs: audioDecodingStartTime,
  });
  return assets;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sfx(
  name: SfxName,
  channel?: number,
  offset?: number,
  length?: number
) {
  if (!audioCtx || !assets) return;
  const sampleSource = audioCtx.createBufferSource();
  sampleSource.buffer = assets.sfxs.get(name)!;
  sampleSource.connect(audioCtx.destination);
  sampleSource.onended = () => {
    sampleSource.disconnect(audioCtx!.destination);
  };
  sampleSource.start();
}

function music(
  name: SfxName | "stop",
  fadeLength?: number,
  channelMask?: number
) {
  if (!audioCtx || !assets) return;

  // This supports crossfade, to not have crossfade a call with stop and fadeLength = 0 or undefined is required before the next music
  if (musicBufferSourceNode) {
    if (fadeLength) {
      musicGainNode!.gain.linearRampToValueAtTime(
        0.0,
        audioCtx.currentTime + fadeLength / 1000
      );
      const capturedSourceNode = musicBufferSourceNode;
      const capturedGainNode = musicGainNode;
      musicBufferSourceNode = null;
      setTimeout(() => {
        capturedSourceNode!.stop();
        capturedSourceNode!.disconnect(capturedGainNode!);
        capturedGainNode!.disconnect(audioCtx!.destination);
      }, fadeLength);
    } else {
      musicBufferSourceNode!.stop();
      musicBufferSourceNode!.disconnect(musicGainNode!);
      musicGainNode!.disconnect(audioCtx.destination);
      musicBufferSourceNode = null;
    }
  }

  if (name === "stop") {
    return;
  }

  musicBufferSourceNode = audioCtx.createBufferSource();
  musicGainNode = audioCtx.createGain();
  musicBufferSourceNode.loop = true;
  musicBufferSourceNode.buffer = assets.sfxs.get(name)!;
  musicBufferSourceNode.connect(musicGainNode);
  musicGainNode.connect(audioCtx.destination);

  if (fadeLength) {
    musicGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    musicGainNode.gain.linearRampToValueAtTime(
      1.0,
      audioCtx.currentTime + fadeLength / 1000
    );
  }

  musicBufferSourceNode!.start();
}

function cls(color = 0) {
  color = engineState.drawPaletteRemap[flr(color)];
  for (let i = 0; i < pixelBuffer.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      pixelBuffer[i + j] = ColorsRGB[color][j];
    }
    pixelBuffer[i + 3] = 255; // remove transparency
  }
}

function print(str: string, x: number, y: number, color: Color) {
  if (!assets) return;
  /* spell-checker: disable */
  const glyphOrder =
    "ññññññññññññññññ" +
    "ññññññññññññññññ" +
    ` !"#$%&'()*+,-./` +
    "0123456789=;<=>?" +
    "@ABCDEFGHIJKLMNO" +
    "PQRSTUVWXYZ[\\]^_" +
    "`abcdefghijklmno" +
    "pqrstuvwxyz{|}~∎" +
    "ññññññññññññññññ" +
    "ññññññññññññññññ" +
    "ññññññññññññññññ" +
    "ññññññññññññññññ" +
    "ññññññññññññññññ" +
    "ññññññññññññññññ" +
    "ññññññññññññññññ" +
    "ññññññññññññññññ";
  /* spell-checker: enable */
  const tileWidth = 7;
  const tileHeight = 5;
  const glyphSeparationX = 1;
  const glyphSeparationY = 3;
  x = flr(x);
  y = flr(y);
  color = flr(color);
  color = engineState.drawPaletteRemap[color];
  for (let c = 0; c < str.length; c++) {
    const ch = str[c];
    // Find character index in _font.bitmap using _font.glyphOrder
    let pos = 32; // 32 === space
    for (let g = 0; g < glyphOrder.length; g++) {
      if (glyphOrder[g] === ch) {
        pos = g;
      }
    }
    const gx = (pos % 16) * (tileWidth + glyphSeparationX);
    const gy = flr(pos / 16) * (tileHeight + glyphSeparationY);
    copyRectMasked(
      gx,
      gy,
      x + c * 4,
      y,
      tileWidth,
      tileHeight,
      assets.fontPixels,
      pixelBuffer,
      7,
      color
    );
  }
}

function printc(str: string, cx: number, y: number, color: Color) {
  const halfStrScreenLengthPx = str.length * 2;
  const x = cx - halfStrScreenLengthPx;
  print(str, x, y, color);
}

function spr(
  n: number,
  dx: number,
  dy: number,
  w = 1,
  h = 1,
  flip_x = false,
  flip_y = false
) {
  if (!assets) return;
  n = flr(n);
  dx = flr(dx);
  dy = flr(dy);
  const spritesPerRow = 16;
  const sx = (n % spritesPerRow) * spriteSizePx;
  const sy = flr(n / spritesPerRow) * spriteSizePx;
  const sizeX = w * spriteSizePx;
  const sizeY = h * spriteSizePx;
  copyRect(
    sx,
    sy,
    dx,
    dy,
    sizeX,
    sizeY,
    assets.spritesPixels,
    pixelBuffer,
    flip_x,
    flip_y
  );
}

const _sprite_flags: number[] = [];
function fget(sprite: number, flag?: number): number | boolean {
  if (flag === undefined) {
    return _sprite_flags[sprite];
  } else {
    return (_sprite_flags[sprite] & (1 << flag)) !== 0;
  }
}

function line(x0: number, y0: number, x1: number, y1: number, col: Color) {
  x0 = flr(x0);
  x1 = flr(x1);
  y0 = flr(y0);
  y1 = flr(y1);
  // // Naive implementation
  // const run = x1 - x0;
  // const rise = y1 - y0;
  // if (run === 0) {
  //   // vertical line
  //   if (y1 < y0) {
  //     const tmp = y0;
  //     y0 = y1;
  //     y1 = tmp;
  //   }
  //   for (let y = y0; y <= y1; y++) {
  //     putPixel(x0, y, col, pixelBuffer);
  //   }
  // } else {
  //   const m = rise / run;
  //   const b = y0 - m * x0;
  //   if (m >= -1 && m <= 1) {
  //     // more horizontal than vertical, we find the y value
  //     if (x1 < x0) {
  //       const tmp = x0;
  //       x0 = x1;
  //       x1 = tmp;
  //     }
  //     for (let x = x0; x <= x1; x++) {
  //       const y = round(m * x + b);
  //       putPixel(x, y, col, pixelBuffer);
  //     }
  //   } else {
  //     if (y1 < y0) {
  //       const tmp = y0;
  //       y0 = y1;
  //       y1 = tmp;
  //     }
  //     for (let y = y0; y <= y1; y++) {
  //       const x = round((y - b) / m);
  //       putPixel(x, y, col, pixelBuffer);
  //     }
  //   }
  // }

  // Bresenham from http://members.chello.at/~easyfilter/bresenham.js
  col = engineState.drawPaletteRemap[col];
  const dx = abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let e2; // error value e_xy

  for (;;) {
    putPixel(x0, y0, col, pixelBuffer);
    if (x0 === x1 && y0 === y1) break;
    e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    } // x step
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    } // y step
  }
}

function circ(xm: number, ym: number, r: number, col: Color) {
  xm = flr(xm);
  ym = flr(ym);
  r = flr(r);
  col = engineState.drawPaletteRemap[col];
  let x = -r;
  let y = 0;
  let err = 2 - 2 * r; /* bottom left to top right */
  do {
    putPixel(xm - x, ym + y, col, pixelBuffer); /*   I. Quadrant +x +y */
    putPixel(xm - y, ym - x, col, pixelBuffer); /*  II. Quadrant -x +y */
    putPixel(xm + x, ym - y, col, pixelBuffer); /* III. Quadrant -x -y */
    putPixel(xm + y, ym + x, col, pixelBuffer); /*  IV. Quadrant +x -y */
    r = err;
    if (r <= y) err += ++y * 2 + 1; /* y step */
    if (r > x || err > y) err += ++x * 2 + 1; /* x step */
  } while (x < 0);
}

function circfill(xm: number, ym: number, r: number, col: Color) {
  col = engineState.drawPaletteRemap[col];
  xm = flr(xm);
  ym = flr(ym);
  r = flr(r);
  let x = -r;
  let y = 0;
  let err = 2 - 2 * r; /* bottom left to top right */
  do {
    line(xm - x, ym + y, xm + x, ym + y, col);
    line(xm - y, ym + x, xm + y, ym + x, col);
    line(xm + y, ym - x, xm - y, ym - x, col);
    r = err;
    if (r <= y) err += ++y * 2 + 1; /* y step */
    if (r > x || err > y) err += ++x * 2 + 1; /* x step */
  } while (x < 0);
}

function rect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color = Color.Black
) {
  x0 = flr(x0);
  y0 = flr(y0);
  x1 = flr(x1);
  y1 = flr(y1);
  color = engineState.drawPaletteRemap[flr(color)];
  for (let x = x0; x < x1 + 1; x++) {
    putPixel(x, y0, color, pixelBuffer);
    putPixel(x, y1, color, pixelBuffer);
  }
  for (let y = y0; y < y1 + 1; y++) {
    putPixel(x0, y, color, pixelBuffer);
    putPixel(x1, y, color, pixelBuffer);
  }
}

function rectfill(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color = Color.Black
) {
  x0 = flr(x0);
  y0 = flr(y0);
  x1 = flr(x1);
  y1 = flr(y1);
  color = engineState.drawPaletteRemap[flr(color)];
  for (let y = y0; y < y1 + 1; y++) {
    for (let x = x0; x < x1 + 1; x++) {
      putPixel(x, y, color, pixelBuffer);
    }
  }
}

function camera(x: number, y: number) {
  engineState.camera.x = -flr(x);
  engineState.camera.y = -flr(y);
}

function pal(c0?: Color, c1?: Color, p: 0 | 1 = 0) {
  if (c0 === undefined) {
    engineState.drawPaletteRemap = palCreate();
    engineState.displayPaletteRemap = palCreate();
  } else {
    if (c1 === undefined) {
      throw new Error("missing parameter c1 in call to pal");
    }
    if (p === 0) {
      engineState.drawPaletteRemap[c0] = c1;
    } else {
      engineState.displayPaletteRemap[c0] = c1;
    }
  }
}

function palt(c: Color, t: boolean) {
  engineState.transparentColors[c] = t;
}

const _map: number[][] = [[]];
function map(
  cell_x: number,
  cell_y: number,
  sx: number,
  sy: number,
  cell_w: number,
  cell_h: number,
  layer?: number
) {
  for (let cy = 0; cy < cell_h; cy++) {
    const y = sy + cy * spriteSizePx;
    for (let cx = 0; cx < cell_w; cx++) {
      const s = _map[cell_x + cx][cell_y + cy];
      const x = sx + cx * spriteSizePx;
      if (layer !== undefined) {
        const sFlags = _sprite_flags[s];
        if ((sFlags & layer) !== 0) {
          spr(s, x, y);
        }
      } else {
        spr(s, x, y);
      }
    }
  }
}

function mget(x: number, y: number) {
  return _map[x][y];
}
function mset(x: number, y: number, value: number) {
  _map[x][y] = value;
}

const buttonMap = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyZ",
  "KeyX",
];
function btn(n?: number) {
  if (n === undefined) {
    let result = 0;
    for (let i = 0; i < 6; i++) {
      if (engineState.buttons[buttonMap[i]]) {
        result = result | (1 << i);
      }
    }
    return result;
  } else {
    return !!engineState.buttons[buttonMap[n]];
  }
}

function dget(i: number) {
  return window.localStorage.getItem(String(i));
}

function dset(i: number, value: string) {
  window.localStorage.setItem(String(i), value);
}

function time() {
  return flr(engineState.updateCount / targetFPS);
}

const t = time;

const userInteractionHappenedPromise = new Promise<void>(
  function userInteractionHappenedExecutor(resolve) {
    function interactionListener() {
      window.removeEventListener("click", interactionListener);
      window.removeEventListener("keydown", interactionListener);
      window.removeEventListener("touchstart", interactionListener);
      window.removeEventListener("touchend", interactionListener);
      resolve();
    }
    window.addEventListener("click", interactionListener);
    window.addEventListener("keydown", interactionListener);
    window.addEventListener("touchstart", interactionListener);
    window.addEventListener("touchend", interactionListener);
  }
);

userInteractionHappenedPromise.then(function whenUserInteractionHappened() {
  audioCtx = new AudioContext();
});

window.addEventListener("keydown", async function keydownListener(e) {
  engineState.buttons[e.code] = true;
});
window.addEventListener("keyup", async function keydownListener(e) {
  engineState.buttons[e.code] = false;
});

window.addEventListener("pointerdown", pointerStart);
window.addEventListener("pointerup", pointerEnd);
window.addEventListener("pointercancel", pointerEnd);
window.addEventListener("pointermove", pointerMove);
window.addEventListener("touchstart", (e) => e.preventDefault());
window.addEventListener("touchend", (e) => e.preventDefault());
window.addEventListener("dragstart", (e) => e.preventDefault());
function pointerStart(e: PointerEvent) {
  e.preventDefault();
}

function pointerEnd(e: PointerEvent) {
  e.preventDefault();
}

function pointerMove(e: PointerEvent) {
  e.preventDefault();
}

function putPixel(
  x: number,
  y: number,
  color: Color,
  dData: Uint8ClampedArray
) {
  color = flr(color);
  x = x + engineState.camera.x;
  y = y + engineState.camera.y;
  if (x < 0 || x >= canvas.width) return;
  if (y < 0 || y >= canvas.height) return;
  const i = x * pixelStride + y * lineStride;
  const colorRGB = ColorsRGB[color];
  for (let j = 0; j < 3; j++) {
    dData[i + j] = colorRGB[j];
  }
}

function copyRect(
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  sizeX: number,
  sizeY: number,
  sData: Uint8ClampedArray,
  dData: Uint8ClampedArray,
  flip_x = false,
  flip_y = false
) {
  let sLineStride = sy * lineStride;
  for (let y = 0; y < sizeY; y++) {
    for (let x = 0; x < sizeX; x++) {
      const s = (sx + x) * pixelStride + sLineStride;
      const sColorRGB = [];
      for (let j = 0; j < 3; j++) {
        sColorRGB.push(sData[s + j]);
      }
      const colorAfterMapping =
        engineState.drawPaletteRemap[colorFromRGB(sColorRGB)];
      if (!engineState.transparentColors[colorAfterMapping]) {
        if (flip_x) {
          putPixel(dx + (sizeX - 1 - x), dy + y, colorAfterMapping, dData);
        } else if (flip_y) {
          putPixel(dx + x, dy + (sizeY - 1 - y), colorAfterMapping, dData);
        } else {
          putPixel(dx + x, dy + y, colorAfterMapping, dData);
        }
      }
    }
    sLineStride += lineStride;
  }
}

function copyRectMasked(
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  sizeX: number,
  sizeY: number,
  sData: Uint8ClampedArray,
  dData: Uint8ClampedArray,
  maskColor: Color,
  outColor: Color
) {
  let sLineStride = sy * lineStride;
  for (let y = 0; y < sizeY; y++) {
    for (let x = 0; x < sizeX; x++) {
      const s = (sx + x) * pixelStride + sLineStride;
      const sColorRGB = [];
      for (let j = 0; j < 3; j++) {
        sColorRGB.push(sData[s + j]);
      }
      if (colorFromRGB(sColorRGB) === maskColor) {
        putPixel(dx + x, dy + y, outColor, dData);
      }
    }
    sLineStride += lineStride;
  }
}

function colorFromRGB(rgb: number[]) {
  for (let c = 0; c < ColorsRGB.length; c++) {
    const colorRGB = ColorsRGB[c];
    if (
      colorRGB[0] === rgb[0] &&
      colorRGB[1] === rgb[1] &&
      colorRGB[2] === rgb[2]
    ) {
      return c;
    }
  }
  throw new Error("Color not found " + rgb);
}

function applyDisplayPaletteRemapping() {
  for (let i = 0; i < pixelBuffer.length; i += 4) {
    const colorRGB = [pixelBuffer[i], pixelBuffer[i + 1], pixelBuffer[i + 2]];
    const colorAfterRemap =
      engineState.displayPaletteRemap[colorFromRGB(colorRGB)];
    const colorAfterRGB = ColorsRGB[colorAfterRemap];
    pixelBuffer[i] = colorAfterRGB[0];
    pixelBuffer[i + 1] = colorAfterRGB[1];
    pixelBuffer[i + 2] = colorAfterRGB[2];
  }
}

async function loadImage(
  path: string,
  progressCallback?: (event: ProgressEvent) => void
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", path);
    xhr.responseType = "blob";
    xhr.onload = function onRequestLoad() {
      const img = new Image();
      function errorImgHandler() {
        URL.revokeObjectURL(img.src);
        reject(new Error(`Failed to load image: ${path}`));
      }
      img.addEventListener("error", errorImgHandler, { once: true });
      img.addEventListener(
        "load",
        function onImgLoad() {
          URL.revokeObjectURL(img.src);
          img.removeEventListener("error", errorImgHandler);
          resolve(img);
        },
        { once: true }
      );
      img.src = URL.createObjectURL(xhr.response);
    };

    xhr.onerror = function onRequestError() {
      reject(new Error(`Network Error could not fetch: ${path}`));
    };

    xhr.onprogress = progressCallback || null;
    xhr.send();
  });
}

async function loadImageData(
  path: string,
  progressCallback?: (event: ProgressEvent) => void
) {
  const img = await loadImage(path, progressCallback);
  const buffer = document.createElement("canvas");
  buffer.width = img.naturalWidth;
  buffer.height = img.naturalHeight;
  const bufferCtx = buffer.getContext("2d");
  if (!bufferCtx) {
    throw new Error(`Failed to buffer.getContext while loading image ${path}`);
  }
  bufferCtx.drawImage(img, 0, 0, buffer.width, buffer.height);
  const imageData = bufferCtx.getImageData(0, 0, buffer.width, buffer.height);
  return imageData;
}

// Map data is stored in the .p8 file as 32 lines of 256 hexadecimal digits (128 bytes).
// Each pair of digits (most significant nybble first) is the sprite ID for a tile on the map,
// ordered left to right, top to bottom, for the first 32 rows of the map.
// The map area is 128 tiles wide by 64 tiles high. Map memory describes the top 32 rows.
// If the cart author draws tiles in the bottom 32 rows, this is stored in the bottom of the __gfx__ section.
// When porting a game from Pico-8, that data is copied to the map.txt file.
async function loadMap(progressCallback?: (event: ProgressEvent) => void) {
  const filename = `assets/map.txt`;
  let mapStr = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", filename);
    xhr.responseType = "text";
    xhr.onload = function onRequestLoad() {
      resolve(xhr.response);
    };

    xhr.onerror = function onRequestError() {
      reject(new Error(`Network Error could not fetch: ${filename}`));
    };

    xhr.onprogress = progressCallback || null;
    xhr.send();
  });

  mapStr = mapStr.replace(/(\r\n|\n|\r)/gm, ""); // Make it a single line
  // Load normal map data
  const mapWidth = 128;
  for (let i = 0; i < mapWidth * (32 * 2); i += 2) {
    const x = (i / 2) % mapWidth;
    const y = flr(i / 2 / mapWidth);
    if (!_map[x]) _map[x] = [];
    _map[x][y] = parseInt(mapStr.slice(i, i + 2), 16);
  }
  // Load data from bottom half of spriteSheet (second half of __gfx__))
  for (let i = mapWidth * (32 * 2); i < mapWidth * (64 * 2); i += 2) {
    const x = (i / 2) % mapWidth;
    const y = flr(i / 2 / mapWidth);
    if (!_map[x]) _map[x] = [];
    _map[x][y] = parseInt(
      mapStr
        .slice(i, i + 2)
        .split("")
        .reverse()
        .join(""),
      16
    );
  }
}

// Flags are represented in the .p8 file as 2 lines of 256 hexadecimal digits (128 bytes).
// Each pair of digits represents the 8 flags (most significant nybble first) for each of the 256 sprites,
// in sprite ID order.
// In the graphics editor, the flags are arranged left to right from LSB to MSB:
// red=1, orange=2, yellow=4, green=8, blue=16, purple=32, pink=64, peach=128.
async function loadSpriteFlags(
  progressCallback?: (event: ProgressEvent) => void
) {
  const filename = `assets/sprite_flags.txt`;
  let flagsStr = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", filename);
    xhr.responseType = "text";
    xhr.onload = function onRequestLoad() {
      resolve(xhr.response);
    };

    xhr.onerror = function onRequestError() {
      reject(new Error(`Network Error could not fetch: ${filename}`));
    };

    xhr.onprogress = progressCallback || null;
    xhr.send();
  });
  flagsStr = flagsStr.replace(/(\r\n|\n|\r)/gm, "");
  for (let i = 0; i < 512; i += 2) {
    _sprite_flags[i / 2] = parseInt(flagsStr.slice(i, i + 2), 16);
  }
}

const sfxNames = [
  "died",
  "jumped",
  "wallJumped",
  "dashed",
  "playerSpawnerCreated",
  "playerSpawnerTouchedGround",
  "balloonGrabbed",
  "balloonReset",
  "fallFloorReset",
  "springUsed",
  "didNotDash",
  "fruitPickedUp",
  "fruitStartedFly",
  "fallFloorShakeStarted",
  "fakeWallDestroyed",
  "chestOpened",
  "keyGrabbed",
  "letterTyped",
  "bigChestOpened",
  "gameStarted",
  "orbGrabbed",
  "dashReset",
  "winFlagTouched",
  "song0",
  "song10",
  "song20",
  "song30",
  "song40",
] as const;
async function loadAudio(
  progressCallback?: (event: { total: number; loaded: number }) => void
) {
  const promises = [];
  const progressEvents = new Map<string, { total: number; loaded: number }>();
  for (let i = 0; i < sfxNames.length; i++) {
    const name = sfxNames[i];
    const filename = `assets/sfx/${name}.wav`;
    const promise = new Promise<ArrayBuffer>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", filename);
      xhr.responseType = "arraybuffer";
      xhr.onload = function onRequestLoad() {
        resolve(xhr.response);
      };

      xhr.onerror = function onRequestError() {
        reject(new Error(`Network Error could not fetch: ${filename}`));
      };

      xhr.onprogress = progressCallback
        ? function onRequestProgress(event) {
            progressEvents.set(filename, event);
            if (progressEvents.size === sfxNames.length) {
              const accumulatedEvent = { total: 0, loaded: 0 };
              for (const event of progressEvents.values()) {
                accumulatedEvent.total += event.total;
                accumulatedEvent.loaded += event.loaded;
              }
              progressCallback(accumulatedEvent);
            }
          }
        : null;
      xhr.send();
    });

    promises.push(promise);
  }
  const sfxBuffers = await Promise.all(promises);
  return sfxBuffers;
}

export {
  // types
  Color,
  // entry point
  start,
  // input
  btn,
  // math
  mod,
  flr,
  ceil,
  round,
  rnd,
  rndi,
  rndf,
  clamp,
  lerp,
  min,
  max,
  mid,
  sin,
  cos,
  sqrt,
  abs,
  sign,
  // vector
  v,
  vma,
  v_add,
  v_sub,
  v_mul,
  v_div,
  v_neg,
  v_dot,
  v_norm,
  v_rotr,
  v_lensq,
  v_len,
  v_str,
  v_lerp,
  // graphics
  camera,
  cls,
  spr,
  fget,
  map,
  mget,
  mset,
  print,
  printc,
  line,
  circ,
  circfill,
  rect,
  rectfill,
  pal,
  palt,
  // audio
  sfx,
  music,
  // cartData
  dset,
  dget,
  time,
  t,
};
export type { Vec, SfxName };

// TODO: use OffscreenCanvas

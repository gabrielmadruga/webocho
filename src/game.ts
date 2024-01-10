import {
  btn,
  camera,
  clamp,
  cos,
  flr,
  max,
  min,
  music,
  pal,
  rectfill,
  rnd,
  sfx,
  sin,
  spr,
  start,
  print,
  map,
  abs,
  sign,
  mget,
  fget,
  line,
  circfill,
  time,
  cls,
  Color,
  round,
  SfxName,
} from "./engine.js";

// This enables hot reloading in vite
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (newModule) {
      window.game = newModule;
    }
  });
}

window.gameState = import.meta.hot?.data ?? ({} as GameState);

// Constants
const SPRITE_W = 8;
const SCREEN_W = 128;
const SCREEN_H = 128;
const MAP_W_TILES = 128;
const MAP_H_TILES = 64;
const SCENE_W_TILES = 16;
const SCENE_H_TILES = 16;
const MAP_W_SCENES = MAP_W_TILES / SCENE_W_TILES; // 8
const MAP_H_SCENES = MAP_H_TILES / SCENE_H_TILES;

const FLAG_SOLID = 0;
const FLAG_ICE = 4;

const K_LEFT = 0;
const K_RIGHT = 1;
const K_UP = 2;
const K_DOWN = 3;
const K_JUMP = 4;
const K_DASH = 5;

const TITLE_LEVEL_ID = 31;
const LAST_LEVEL_ID = 30;

export type GameState = {
  currentFrame: number;
  backgroundColor: Color;
  shouldFlashBackground: boolean;
  useOrbBackground: boolean;
  deathCount: number;
  pickedFruitInLevel: boolean[];
  timers: Record<"freeze" | "shake" | "playMusic" | "mutePsfxs", number>;
  timeElapsed: TimeElapsed;

  gameObjects: GameObject[];
  gameObjectPool: Set<GameObject>;
  gameObjectsByType: Map<string, GameObject[]>;
};

export function init() {
  gameState.currentFrame = 0;
  gameState.backgroundColor = 0;
  gameState.shouldFlashBackground = false;
  gameState.useOrbBackground = false;
  gameState.deathCount = 0;
  gameState.pickedFruitInLevel = Array(30).fill(false);

  gameState.timers = {
    freeze: 0,
    shake: 0,
    playMusic: 0,
    mutePsfxs: 0,
  };
  gameState.timeElapsed = {
    epoch: 0,
    seconds: 0,
    minutes: 0,
    hours: 0,
  };
  gameState.gameObjects = Array(maxGameObjectCount);
  for (let i = 0; i < maxGameObjectCount; i++) {
    gameState.gameObjects[i] = {
      ...gameObjectTemplate,
    };
  }
  gameState.gameObjectPool = new Set(gameState.gameObjects);
  gameState.gameObjectsByType = new Map();

  music("song40", 0, 7);
  const titleScreen = createGameObject("TitleScreen");
  // Title screen is on the last part of the map. There are 32 screens worth of map, indexed from 0, so it's the number 31
  // This is the conversion from 1d to 2d indexing (unflattening/mapping) of sceneId to map coords (in scenes) and then converting to tile coords by scaling using sceneInTiles
  titleScreen.tileX = (TITLE_LEVEL_ID % MAP_W_SCENES) * SCENE_W_TILES; // (31 % 8) * 16 = 112 || max map coord (in tiles) is 128 and each scene has 16 tiles, so 128 - 16 = 112
  titleScreen.tileY = flr(TITLE_LEVEL_ID / MAP_W_SCENES) * SCENE_H_TILES; // (31 / 8) * 16 = 48 || max map coord (in tiles) is 64 and each scene has 16 tiles, so 64 - 16 = 48

  createSnowParticles();
}

export function update() {
  // decrease each timer by one and trigger the effect if it reaches 0
  const timers = gameState.timers;
  const keys = Object.keys(timers);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i] as keyof GameState["timers"];
    if (timers[key] > 0) {
      timers[key] -= 1;
      if (timers[key] === 0) {
        switch (key) {
          case "playMusic":
            music("song10", 0, 7);
            break;
        }
      }
    }
  }

  gameState.currentFrame = (gameState.currentFrame + 1) % 30; // update on which frame we are now
  if (timers["freeze"] > 0) return;

  if (gameState.shouldFlashBackground) {
    gameState.backgroundColor = gameState.currentFrame / 5;
  } else if (gameState.useOrbBackground) {
    gameState.backgroundColor = 2;
  }

  updateGameObjects();
}

export function draw() {
  if (gameState.timers["freeze"] > 0) return;
  pal(); // reset the color palette
  cls(gameState.backgroundColor); // clear the screen with the current background color
  camera(0, 0); // reset the camera
  if (gameState.timers["shake"] > 0) {
    // screenShake if timer (in frames) is > 0
    camera(-2 + rnd(5), -2 + rnd(5)); // set the camera to a random value in the [-2, 3) range, actually [-2, 2] as the camera function floors it
  }

  drawGameObjects();

  // screenShake fix = draw outside of the screen so that the not drawn area (caused by moving the camera) is always black, even if we change tha background color
  rectfill(-2, -2, -1, SCREEN_H + 2, 0); // Left
  rectfill(-2, -2, SCREEN_H + 2, -1, 0); // Top
  rectfill(-2, SCREEN_H, SCREEN_W + 2, SCREEN_H + 2, 0); // Bottom
  rectfill(SCREEN_W, -2, SCREEN_W + 1, SCREEN_H + 2, 0); // Right
}

// A fixed amount of GameObjects is used.
// This can be useful to know how many are needed and how many can be used without degrading
let gameObjectIdCounter = 0;
const maxGameObjectCount = 1000;
type GameObject = {
  id: number;
  type: string;
  parent: GameObject | null;
  children: GameObject[];

  // Use isDestroyed if the GameObject being destroyed is the one that is updating, otherwise use timeToLive = 1. This is so that if one GameObject destroys another one, the other has an oportunity to update.
  isDestroyed: boolean; // this flag is used to indicate the GameObject is free to be used when a new one is needed and won't update or render
  ageInFrames: number;
  maxAgeInFrames: number; // once ageInFrames reaches maxAgeInFrames the GameObject will be destroyed
  t: number; // usually used for custom animations and stuff with frames
  paused: boolean; // rendered but not updated

  // Positioning and movement
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  movementReminderX: number;
  movementReminderY: number;
  isSolid: boolean; // solids stop each other when moving
  targetX: number;
  targetY: number;
  state: string;

  // Collision detection
  isCollidable: boolean; // only collidables are included in collision detection
  hitboxX: number;
  hitboxY: number;
  hitboxH: number;
  hitboxW: number;

  // Rendering
  tileX: number;
  tileY: number;
  sprite: number;
  spriteOffset: number;
  flipX: boolean;
  flipY: boolean;
  color: number;
  rectWidth: number;
  rectHeight: number;
  radius: number;
  usePositionAsCenter: boolean; // indicates if the x, y coordinate is the center instead of the top left corner
  drawOrder: number;

  // Un-categorized player stuff
  hasDashedInScene: boolean;
  hasKeyInScene: boolean;
  pressedJump: boolean;
  pressedDash: boolean;
  grace: number;
  jumpBuffer: number;
  wasOnGround: boolean;
  currentDashJumpsCount: number;
  maxDashJumpsCount: number;
  dashTime: number;
  dashEffectTime: number;
  dashTargetX: number;
  dashTargetY: number;
  dashAccelerationX: number;
  dashAccelerationY: number;
} & any;

const gameObjectTemplate: GameObject = {
  id: -1,
  type: "untyped",
  parent: null,
  children: [] as GameObject[],

  isDestroyed: true,
  ageInFrames: 0,
  maxAgeInFrames: 0,
  t: 0,
  paused: false,

  x: 0,
  y: 0,
  speedX: 0,
  speedY: 0,
  movementReminderX: 0,
  movementReminderY: 0,
  isSolid: false,
  targetX: -1,
  targetY: -1,
  state: "",

  isCollidable: true,
  hitboxX: 0,
  hitboxY: 0,
  hitboxW: SPRITE_W,
  hitboxH: SPRITE_W,

  tileX: -1,
  tileY: -1,
  sprite: 0,
  spriteOffset: 0,
  flipX: false,
  flipY: false,
  color: 0,
  rectWidth: -1,
  rectHeight: -1,
  radius: -1,
  usePositionAsCenter: false,
  drawOrder: 0,

  hasDashedInScene: false,
  hasKeyInScene: false,
  pressedJump: false,
  pressedDash: false,
  grace: 0,
  jumpBuffer: 0,
  wasOnGround: false,
  currentDashJumpsCount: 1,
  maxDashJumpsCount: 1,
  dashTime: 0,
  dashEffectTime: 0,
  dashTargetX: 0,
  dashTargetY: 0,
  dashAccelerationX: 0,
  dashAccelerationY: 0,
} as const;

function createGameObject(type: string, parent?: GameObject) {
  const { gameObjectPool, gameObjectsByType } = gameState;
  for (const g of gameObjectPool) {
    gameObjectPool.delete(g);
    Object.assign(g, structuredClone(gameObjectTemplate));
    g.id = gameObjectIdCounter++;
    g.type = type;
    g.isDestroyed = false;
    const byTypeSet = gameObjectsByType.get(type);
    if (!byTypeSet) {
      const newByType = [];
      newByType.push(g);
      gameObjectsByType.set(type, newByType);
    } else {
      byTypeSet.push(g);
    }
    if (parent) {
      g.parent = parent;
      parent.children.push(g);
    }
    return g;
  }
  throw new Error("No more space in the GameObjects pool");
}

function destroyGameObject(gameObject: GameObject) {
  const { gameObjectPool, gameObjectsByType } = gameState;
  gameObject.isDestroyed = true;
  gameObjectPool.add(gameObject);
  const byType = gameObjectsByType.get(gameObject.type)!;
  byType.splice(byType.indexOf(gameObject), 1);
  for (const child of gameObject.children) {
    child.parent = null;
    destroyGameObject(child);
  }
  if (gameObject.parent) {
    gameObject.parent.children.splice(
      gameObject.parent.children.indexOf(gameObject),
      1
    );
  }
  // console.log(`onDestroy: ${gameObject.type}`);
  switch (gameObject.type) {
    case "TitleScreen": {
      gameState.timeElapsed.epoch = time();
      const levels = createGameObject("Levels");
      const clouds = createClouds();
      for (const cloud of clouds) {
        cloud.parent = levels;
        cloud.parent.children.push(cloud);
      }
      music("song0");
      const firstLevel = createLevel(0);
      firstLevel.parent = levels;
      firstLevel.parent.children.push(firstLevel);
      break;
    }
    case "DeathParticles": {
      const level = getGameObjectOfType("Level")!;
      createLevel(level.id);
      destroyGameObject(level);
      break;
    }
  }
}

function updateGameObjects() {
  // console.log("updateGameObjects");
  for (let i = 0; i < gameState.gameObjects.length; i++) {
    const g = gameState.gameObjects[i];
    if (g.isDestroyed || g.paused) continue;
    if (g.maxAgeInFrames > 0 && g.ageInFrames === g.maxAgeInFrames) {
      destroyGameObject(g);
      continue;
    }

    if (g.type === "SnowParticle") {
      g.speedY = sin(g.ageInFrames * min(0.05, g.speedX / 32));
    }

    // Move
    {
      g.movementReminderX += g.speedX;
      g.movementReminderY += g.speedY;

      const roundedAmountX = round(g.movementReminderX);
      const roundedAmountY = round(g.movementReminderY);

      g.movementReminderX -= roundedAmountX;
      g.movementReminderY -= roundedAmountY;

      if (g.isSolid) {
        const stepX = sign(roundedAmountX);
        for (let i = 0; i <= abs(roundedAmountX); i++) {
          if (!gameObjectCollidesWithSolid(g, stepX, 0)) {
            g.x += stepX;
          } else {
            g.speedX = 0;
            g.movementReminderX = 0;
            break;
          }
        }
        const stepY = sign(roundedAmountY);
        for (let i = 0; i <= abs(roundedAmountY); i++) {
          if (!gameObjectCollidesWithSolid(g, 0, stepY)) {
            g.y += stepY;
          } else {
            g.speedY = 0;
            g.movementReminderY = 0;
            break;
          }
        }
      } else {
        g.x += roundedAmountX;
        g.y += roundedAmountY;
      }
    }

    switch (g.type) {
      case "TitleScreen": {
        if (g.maxAgeInFrames === 0 && (btn(K_JUMP) || btn(K_DASH))) {
          music("stop");
          sfx("gameStarted");
          g.maxAgeInFrames = g.ageInFrames + 70;
        }
        break;
      }
      case "Level": {
        if (g.id < LAST_LEVEL_ID) {
          // Don't count time on 30 and 31 (last level and title screen)
          const timeElapsed = gameState.timeElapsed;
          const timeSinceGameStart = time() - timeElapsed.epoch;
          timeElapsed.seconds = timeSinceGameStart % 60;
          timeElapsed.minutes = flr(timeSinceGameStart / 60) % 60;
          timeElapsed.hours = flr(timeElapsed.minutes / 60);
        }
        break;
      }
      case "PlayerSpawner": {
        if (g.state === "GoingUp") {
          if (g.y < g.targetY + SPRITE_W * 2) {
            g.state = "Falling";
            g.t = 3; // Stay 3 frames at the top
          }
        } else if (g.state == "Falling") {
          g.speedY += 0.5;
          if (g.speedY > 0) {
            if (g.t > 0) {
              // this is what keeps celeste at the top 3 frames
              g.speedY = 0;
              g.t -= 1;
            }
            if (g.y > g.targetY) {
              g.y = g.targetY;
              g.speedX = 0;
              g.speedY = 0;
              g.state = "Landing";
              g.t = 5;
              gameState.timers["shake"] = 5;
              createSmoke(g.x, g.y + 4);
              sfx("playerSpawnerTouchedGround");
            }
          }
        } else if (g.state === "Landing") {
          g.t -= 1;
          g.sprite = 6;
          if (g.t < 0) {
            destroyGameObject(g);
            createPlayer(g.x, g.y);
          }
        }
        break;
      }
      case "Player": {
        const input = (btn(K_RIGHT) && 1) || (btn(K_LEFT) && -1) || 0;
        const level = getGameObjectOfType("Level")!;
        // -- spikes collide
        if (
          spikesAt(
            level.tileX,
            level.tileY,
            g.x + g.hitboxX,
            g.y + g.hitboxY,
            g.hitboxW,
            g.hitboxH,
            g.speedX,
            g.speedY
          )
        ) {
          destroyPlayer(g);
        }

        // -- bottom death
        if (g.y > SCREEN_H) {
          destroyPlayer(g);
        }

        const isOnGround = gameObjectCollidesWithSolid(g, 0, 1);
        const isOnIce = gameObjectCollidesWithIce(g, 0, 1);

        // -- smoke particles
        if (isOnGround && !g.wasOnGround) {
          createSmoke(g.x, g.y + 4);
        }

        const shouldJump = btn(K_JUMP) && !g.pressedJump;
        g.pressedJump = btn(K_JUMP) as boolean;
        if (shouldJump) {
          g.jumpBuffer = 4;
        } else if (g.jumpBuffer > 0) {
          g.jumpBuffer -= 1;
        }

        const shouldDash = btn(K_DASH) && !g.pressedDash;
        g.pressedDash = btn(K_DASH) as boolean;

        if (isOnGround) {
          g.grace = 6;
          if (g.currentDashJumpsCount < g.maxDashJumpsCount) {
            psfx("dashReset");
            g.currentDashJumpsCount = g.maxDashJumpsCount;
          }
        } else if (g.grace > 0) {
          g.grace -= 1;
        }

        g.dashEffectTime -= 1;
        if (g.dashTime > 0) {
          createSmoke(g.x, g.y);
          g.dashTime -= 1;
          g.speedX = adjustValueWithinRange(
            g.speedX,
            g.dashTargetX,
            g.dashAccelerationX
          );
          g.speedY = adjustValueWithinRange(
            g.speedY,
            g.dashTargetY,
            g.dashAccelerationY
          );
        } else {
          // -- move
          const maxrun = 1;
          let accel = 0.6;
          const deccel = 0.15;

          if (!isOnGround) {
            accel = 0.4;
          } else if (isOnIce) {
            accel = 0.05;
          }

          if (abs(g.speedX) > maxrun) {
            g.speedX = adjustValueWithinRange(
              g.speedX,
              sign(g.speedX) * maxrun,
              deccel
            );
          } else {
            g.speedX = adjustValueWithinRange(g.speedX, input * maxrun, accel);
          }

          // --facing
          if (g.speedX != 0) {
            g.flipX = g.speedX < 0;
          }

          // -- gravity
          let maxfall = 2;
          let gravity = 0.21;

          if (abs(g.speedY) <= 0.15) {
            gravity *= 0.5;
          }

          // -- wall slide
          if (
            input != 0 &&
            gameObjectCollidesWithSolid(g, input, 0) &&
            !gameObjectCollidesWithIce(g, input, 0)
          ) {
            maxfall = 0.4;
            if (rnd(10) < 2) {
              createSmoke(g.x + input * 6, g.y);
            }
          }

          if (!isOnGround) {
            g.speedY = adjustValueWithinRange(g.speedY, maxfall, gravity);
          }

          // -- jump
          if (g.jumpBuffer > 0) {
            if (g.grace > 0) {
              // -- normal jump
              psfx("jumped");
              g.jumpBuffer = 0;
              g.grace = 0;
              g.speedY = -2;
              createSmoke(g.x, g.y + SPRITE_W / 2);
            } else {
              // -- wall jump
              const wall_dir =
                (gameObjectCollidesWithSolid(g, -3, 0) && -1) ||
                (gameObjectCollidesWithSolid(g, 3, 0) && 1) ||
                0;
              if (wall_dir != 0) {
                psfx("wallJumped");
                g.jumpBuffer = 0;
                g.speedY = -2;
                g.speedX = -wall_dir * (maxrun + 1);
                if (!gameObjectCollidesWithIce(g, wall_dir * 3, 0)) {
                  createSmoke(g.x + wall_dir * 6, g.y);
                }
              }
            }
          }

          // -- dash
          const d_full = 5;
          const d_half = d_full * 0.70710678118;

          if (g.currentDashJumpsCount > 0 && shouldDash) {
            createSmoke(g.x, g.y);
            g.currentDashJumpsCount -= 1;
            g.dashTime = 4;
            g.hasDashedInScene = true;
            g.dashEffectTime = 10;
            const v_input = (btn(K_UP) && -1) || (btn(K_DOWN) && 1) || 0;
            if (input != 0) {
              if (v_input != 0) {
                g.speedX = input * d_half;
                g.speedY = v_input * d_half;
              } else {
                g.speedX = input * d_full;
                g.speedY = 0;
              }
            } else if (v_input != 0) {
              g.speedX = 0;
              g.speedY = v_input * d_full;
            } else {
              g.speedX = (g.flipX && -1) || 1;
              g.speedY = 0;
            }

            psfx("dashed");
            gameState.timers["freeze"] = 2;
            gameState.timers["shake"] = 6;
            g.dashTargetX = 2 * sign(g.speedX);
            g.dashTargetY = 2 * sign(g.speedY);
            g.dashAccelerationX = 1.5;
            g.dashAccelerationY = 1.5;

            if (g.speedY < 0) {
              g.dashTargetY *= 0.75;
            }

            if (g.speedY != 0) {
              g.dashAccelerationX *= 0.70710678118;
            }
            if (g.speedX != 0) {
              g.dashAccelerationY *= 0.70710678118;
            }
          } else if (shouldDash && g.currentDashJumpsCount <= 0) {
            psfx("didNotDash");
            createSmoke(g.x, g.y);
          }
        }

        // -- animation
        g.spriteOffset += 0.25;
        if (!isOnGround) {
          if (gameObjectCollidesWithSolid(g, input, 0)) {
            g.sprite = 5;
          } else {
            g.sprite = 3;
          }
        } else if (btn(K_DOWN)) {
          g.sprite = 6;
        } else if (btn(K_UP)) {
          g.sprite = 7;
        } else if (g.speedX == 0 || (!btn(K_LEFT) && !btn(K_RIGHT))) {
          g.sprite = 1;
        } else {
          g.sprite = 1 + (g.spriteOffset % 4);
        }

        // -- next level
        if (g.y < -4 && level.id < LAST_LEVEL_ID) {
          destroyGameObject(g);
          const level = getGameObjectOfType("Level")!;
          destroyGameObject(level);
          const nextLevel = (level.id + 1) % 32;
          if (nextLevel === 11) {
            music("song30", 500);
          }
          if (nextLevel === 12) {
            music("song20", 500);
          }
          if (nextLevel === 21) {
            music("song30", 500);
          }
          if (nextLevel === 30) {
            music("song30", 500);
          }
          createLevel(nextLevel);
          return;
        }

        // -- was on the ground
        g.wasOnGround = isOnGround;

        // clamp in screen
        if (g.x < -1 || g.x > 121) {
          g.x = clamp(g.x, -1, 121);
          g.speedX = 0;
        }

        for (const hair of g.children[0].children) {
          hair.color =
            g.currentDashJumpsCount === 1
              ? 8
              : g.currentDashJumpsCount === 2
              ? 7 + flr((gameState.currentFrame / 3) % 2) * 4
              : 12;
        }

        break;
      }
      case "Hairs": {
        const parent = g.parent!;
        let last = {
          x: parent.x + 4 - (parent.flipX ? -1 : 1) * 2,
          y: parent.y + ((btn(K_DOWN) && 4) || 3),
        };
        for (const hair of g.children) {
          hair.x += (last.x - hair.x) / 1.5;
          hair.y += (last.y + 0.5 - hair.y) / 1.5;
          last = hair;
        }
        break;
      }
      case "DeathParticle": {
        g.rectWidth = 2 * ((g.maxAgeInFrames - g.ageInFrames) / 5);
        g.color = 14 + (g.ageInFrames % 2);
        break;
      }
      case "Smoke": {
        g.sprite += 0.2;
        if (g.sprite > 31) {
          destroyGameObject(g);
        }
        break;
      }
      case "FallFloor": {
        const player = getGameObjectOfType("Player");
        switch (g.state) {
          case "idle":
            if (
              gameObjectFirstCollision(g, 0, -1, [player]) ||
              gameObjectFirstCollision(g, -1, 0, [player]) ||
              gameObjectFirstCollision(g, 1, 0, [player])
            ) {
              fallFloorBreak(g);
            }
            break;
          case "shaking":
            g.delay -= 1;
            if (g.delay <= 0) {
              g.state = "invisible/resetting";
              g.delay = 60; // how long it hides for
              g.isCollidable = false;
            }
            break;
          case "invisible/resetting":
            g.delay -= 1;
            if (g.delay <= 0 && !gameObjectFirstCollision(g, 0, 0, [player])) {
              psfx("fallFloorReset");
              g.state = "idle";
              g.isCollidable = true;
              createSmoke(g.x, g.y);
            }
            break;
        }
        break;
      }
      case "SnowParticle": {
        if (g.x > SCREEN_W + 4) {
          g.x = -4;
          g.y = rnd(SCREEN_H);
        }
        break;
      }
      case "Cloud": {
        g.color = gameState.backgroundColor === 2 ? 14 : 1;
        if (g.x > SCREEN_W) {
          g.x = -g.rectWidth;
          g.y = rnd(SCREEN_H - 10);
        }
        break;
      }
      case "FakeWall": {
        // this allows to dash while being sliding it and still break it
        g.hitboxX = -1;
        g.hitboxY = -1;
        g.hitboxW = 18;
        g.hitboxH = 18;
        const player = gameObjectFirstCollision(g, 0, 0, [
          getGameObjectOfType("Player"),
        ]);
        if (player && player.dashEffectTime > 0) {
          player.speedX = -sign(player.speedX) * 1.5;
          player.speedY = -1.5;
          player.dashTime = -1;
          gameState.timers["mutePsfxs"] = 20;
          sfx("fakeWallDestroyed");
          destroyGameObject(g);
          createSmoke(g.x, g.y);
          createSmoke(g.x + 8, g.y);
          createSmoke(g.x, g.y + 8);
          createSmoke(g.x + 8, g.y + 8);
          const level = getGameObjectOfType("Level");
          const fruit = createFruit(g.x + 4, g.y + 4);
          fruit.parent = level;
          fruit.parent.children.push(fruit);
        } else {
          g.hitboxX = 0;
          g.hitboxY = 0;
          g.hitboxW = 16;
          g.hitboxH = 16;
        }
        break;
      }
      case "Spring": {
        if (g.hideFor > 0) {
          g.hideFor -= 1;
          if (g.hideFor <= 0) {
            g.sprite = 18;
            g.delay = 0;
          }
        } else if (g.sprite == 18) {
          const player = gameObjectFirstCollision(g, 0, 0, [
            getGameObjectOfType("Player"),
          ]);
          if (player && player.speedY >= 0) {
            g.sprite = 19;
            player.y = g.y - 4;
            player.speedX *= 0.2;
            player.speedY = -3;
            player.currentDashJumpsCount = player.maxDashJumpsCount;
            g.delay = 10;
            createSmoke(g.x, g.y);

            // breakable below us
            const fallFloors = getGameObjectsOfType("FallFloor");
            const fallFloorBelow = gameObjectFirstCollision(
              g,
              0,
              1,
              fallFloors
            );
            if (fallFloorBelow) {
              fallFloorBreak(fallFloorBelow);
            }
            psfx("springUsed");
          }
        } else if (g.delay > 0) {
          g.delay -= 1;
          if (g.delay <= 0) {
            g.sprite = 18;
          }
        }
        // begin hiding
        if (g.hideIn > 0) {
          g.hideIn -= 1;
          if (g.hideIn <= 0) {
            g.hideFor = 60;
            g.sprite = 0;
          }
        }
        break;
      }
      case "Flag": {
        g.sprite = 118 + ((gameState.currentFrame / 5) % 3);
        const player = gameObjectFirstCollision(g, 0, 0, [
          getGameObjectOfType("Player"),
        ]);
        if (!g.shouldShowStats && player) {
          sfx("winFlagTouched");
          gameState.timers["mutePsfxs"] = 30;
          g.shouldShowStats = true;
        }
        break;
      }
      case "Balloon": {
        if (g.sprite === 22) {
          // TODO: why use the sprite for this, nasty
          g.offset += 0.01;
          g.y = g.start + sin(g.offset) * 2;
          const player = gameObjectFirstCollision(g, 0, 0, [
            getGameObjectOfType("Player"),
          ]);
          if (
            player &&
            player.currentDashJumpsCount < player.maxDashJumpsCount
          ) {
            psfx("balloonGrabbed");
            createSmoke(g.x, g.y);
            player.currentDashJumpsCount = player.maxDashJumpsCount;
            g.sprite = 0;
            g.timer = 60;
          }
        } else if (g.timer > 0) {
          g.timer -= 1;
        } else {
          psfx("balloonReset");
          createSmoke(g.x, g.y);
          g.sprite = 22;
        }
        break;
      }
      case "Key": {
        const was = flr(g.sprite);
        g.sprite = 9 + (sin(gameState.currentFrame / 30) + 0.5) * 1;
        const is = flr(g.sprite);
        if (is == 10 && is !== was) {
          g.flipX = !g.flipX;
        }
        const player = gameObjectFirstCollision(g, 0, 0, [
          getGameObjectOfType("Player"),
        ]);
        if (player) {
          sfx("keyGrabbed");
          gameState.timers["mutePsfxs"] = 10;
          player.hasKeyInScene = true;
          destroyGameObject(g);
        }
        break;
      }
      case "Fruit": {
        const level = getGameObjectOfType("Level");
        const player = gameObjectFirstCollision(g, 0, 0, [
          getGameObjectOfType("Player"),
        ]);
        if (player) {
          player.currentDashJumpsCount = player.maxDashJumpsCount;
          gameState.timers["mutePsfxs"] = 20;
          sfx("fruitPickedUp");
          gameState.pickedFruitInLevel[level.id] = true;
          createLifeUp(g.x, g.y);
          destroyGameObject(g);
        }
        g.off += 1;
        g.y = g.start + sin(g.off / 40) * 2.5;
        break;
      }
      case "FlyFruit": {
        const player = getGameObjectOfType("Player");
        if (g.fly) {
          if (g.sfxDelay > 0) {
            g.sfxDelay -= 1;
            if (g.sfxDelay <= 0) {
              gameState.timers["mutePsfxs"] = 20;
              sfx("fruitStartedFly");
            }
          }
          g.speedY = adjustValueWithinRange(g.speedY, -3.5, 0.25);
          if (g.y < -16) {
            destroyGameObject(g);
          }
          // wait
        } else {
          if (player?.hasDashedInScene) {
            g.fly = true;
          }
          g.step += 0.05;
          g.speedY = sin(g.step) * 0.5;
        }
        // collect
        const collidesWithPlayer = gameObjectFirstCollision(g, 0, 0, [player]);
        const level = getGameObjectOfType("Level");
        if (collidesWithPlayer) {
          player.currentDashJumpsCount = player.maxDashJumpsCount;
          gameState.timers["mutePsfxs"] = 20;
          sfx("fruitPickedUp");
          gameState.pickedFruitInLevel[level.id] = true;
          createLifeUp(g.x, g.y);
          destroyGameObject(g);
        }
        break;
      }
      case "Chest": {
        const player = getGameObjectOfType("Player");
        if (player?.hasKeyInScene) {
          g.timer -= 1;
          g.x = g.start - 1 + rnd(3);
          if (g.timer <= 0) {
            gameState.timers["mutePsfxs"] = 20;
            sfx("chestOpened");
            const level = getGameObjectOfType("Level");
            const fruit = createFruit(g.x, g.y - 4);
            fruit.parent = level;
            fruit.parent.children.push(fruit);
            destroyGameObject(g);
          }
        }
        break;
      }
      case "Platform": {
        g.speedX = g.direction * 0.65;
        if (g.x < -g.hitboxW) {
          g.x = SCREEN_W;
        } else if (g.x > SCREEN_W) {
          g.x = -g.hitboxW;
        }
        const player = getGameObjectOfType("Player");
        const collidesWithPlayer = gameObjectFirstCollision(g, 0, 0, [player]);
        if (!collidesWithPlayer) {
          const collidesWithPlayer = gameObjectFirstCollision(g, 0, -1, [
            player,
          ]);
          if (collidesWithPlayer) {
            gameObjectMoveX(player, g.x - g.last, 1);
          }
        }
        g.last = g.x;
        break;
      }
      case "Orb": {
        g.speedY = adjustValueWithinRange(g.speedY, 0, 0.5);
        const player = gameObjectFirstCollision(g, 0, 0, [
          getGameObjectOfType("Player"),
        ]);
        if (player && g.speedY == 0) {
          gameState.timers["playMusic"] = 45;
          sfx("orbGrabbed");
          gameState.timers["freeze"] = 10;
          gameState.timers["shake"] = 10;
          destroyGameObject(g);
          player.maxDashJumpsCount = 2;
          player.currentDashJumpsCount = 2;
        }
        break;
      }
      case "Message": {
        if (
          gameObjectFirstCollision(g, 4, 0, [getGameObjectOfType("Player")])
        ) {
          if (g.index < g.text.length) {
            g.index += 0.5;
            if (g.index >= g.last + 1) {
              g.last += 1;
              sfx("letterTyped");
            }
          }
        } else {
          g.index = 0;
          g.last = 0;
        }
        break;
      }
      case "BigChest": {
        const player = getGameObjectOfType("Player");
        if (g.state === "closed") {
          const collidesWithPlayer = gameObjectFirstCollision(g, 0, 8, [
            player,
          ]);
          if (collidesWithPlayer && gameObjectCollidesWithSolid(player, 0, 1)) {
            music("stop", 500);
            sfx("bigChestOpened");
            player.paused = true;
            player.speedX = 0;
            player.speedY = 0;
            g.state = "opening";
            createSmoke(g.x, g.y);
            createSmoke(g.x + SPRITE_W, g.y);
          }
        } else if (g.state === "opening") {
          g.t -= 1;
          gameState.timers["shake"] = 5;
          gameState.shouldFlashBackground = true;
          if (g.t <= 45 && g.particles.length < 50) {
            g.particles.push({
              x: 1 + rnd(14),
              y: 0,
              height: 32 + rnd(32),
              speedY: 8 + rnd(8),
            });
          }
          if (g.t < 0) {
            g.state = "opened";
            g.particles = [];
            gameState.shouldFlashBackground = false;
            gameState.useOrbBackground = true;
            createOrb(g.x + SPRITE_W / 2, g.y + SPRITE_W / 2);
            player.paused = false;
          }
        }
        for (let i = 0; i < g.particles.length; i++) {
          const p = g.particles[i];
          p.y += p.speedY;
        }
        break;
      }
    }

    g.ageInFrames += 1;
  }
}

// let ts = 0;
// let count = 0;
function drawGameObjects() {
  // const t = performance.now();
  sortGameObjectsByDrawOrder(gameState.gameObjects);
  // ts += performance.now() - t;
  // count++;
  // if (count % 250 === 0) console.log(ts / count);
  for (let i = 0; i < gameState.gameObjects.length; i++) {
    const g = gameState.gameObjects[i];
    if (g.isDestroyed) continue;
    if (g.rectWidth > -1) {
      const h = g.rectHeight < 0 ? g.rectWidth : g.rectHeight;
      if (g.usePositionAsCenter) {
        const hw = flr(g.rectWidth / 2); // hw = half width
        const hh = flr(h / 2);
        rectfill(g.x - hw, g.y - hh, g.x + hw, g.y + hh, g.color);
      } else {
        rectfill(g.x, g.y, g.x + g.rectWidth, g.y + h, g.color);
      }
    }
    if (g.radius > -1) {
      circfill(g.x, g.y, g.radius, g.color);
    }
    if (g.sprite > 0 && g.type !== "BigChest") {
      if (g.type === "Player") {
        const hairColor = g.children[0].children[0].color;
        pal(8, hairColor);
        spr(g.sprite, g.x, g.y, 1, 1, g.flipX, g.flipY);
        pal(8, 8);
      } else if (g.type === "FallFloor") {
        if (g.state !== "invisible/resetting") {
          if (g.state === "shaking") {
            spr(g.sprite + (15 - g.delay) / 5, g.x, g.y);
          } else {
            spr(g.sprite, g.x, g.y, 1, 1, g.flipX, g.flipY);
          }
        }
      } else {
        if (g.type === "Balloon") {
          spr(13 + ((g.offset * 8) % 3), g.x, g.y + 6);
        }
        spr(g.sprite, g.x, g.y, 1, 1, g.flipX, g.flipY);
      }
    }
    switch (g.type) {
      case "TitleScreen": {
        //  start game flash
        const t = g.maxAgeInFrames - g.ageInFrames;
        if (t >= 0) {
          let c: number | null = null;
          if (t > 40) {
            if (gameState.currentFrame % 10 < 5) {
              c = 7;
            }
          } else if (t > 35) {
            c = 2;
          } else if (t > 30) {
            c = 1;
          } else {
            c = 0;
          }
          if (c !== null) {
            pal(6, c);
            pal(7, c);
            pal(12, c);
            pal(13, c);
            pal(5, c);
            pal(1, c);
          }
        }

        map(g.tileX, g.tileY, -4, 0, SCENE_W_TILES, SCENE_H_TILES, 2);
        print("x+c", 58, 80, 5);
        print("matt thorson", 42, 96, 5);
        print("noel berry", 46, 102, 5);
        break;
      }
      case "Level": {
        // message that appears when the scene loads
        if (
          g.id !== TITLE_LEVEL_ID &&
          g.ageInFrames > 5 &&
          g.ageInFrames < 30
        ) {
          rectfill(24, 58, 104, 70, 0);
          if (g.id === 11) {
            print("old site", 48, 62, 7);
          } else if (g.id == LAST_LEVEL_ID) {
            print("summit", 52, 62, 7);
          } else {
            const level = (1 + g.id) * 100;
            print(level + " m", 52 + ((level < 1000 && 2) || 0), 62, 7);
          }
          timeElapsedDraw(gameState.timeElapsed, 4, 4);
        }

        // last scene black sidebars
        if (g.id === LAST_LEVEL_ID) {
          const player = getGameObjectOfType("Player");
          if (player) {
            const diff = min(24, 40 - abs(player.x + 4 - 64));
            rectfill(0, 0, diff, 128, 0);
            rectfill(128 - diff, 0, 128, 128, 0);
          }
        }
        break;
      }
      case "Terrain": {
        const parent = g.parent!;
        map(
          parent.tileX,
          parent.tileY,
          0,
          0,
          SCENE_W_TILES,
          SCENE_H_TILES,
          g.id
        );
        break;
      }
      case "FakeWall": {
        // This can be generalized if I add spriteCountX, spriteCountY, and spriteSheetStride
        spr(64, g.x, g.y);
        spr(65, g.x + SPRITE_W, g.y);
        spr(80, g.x, g.y + 8);
        spr(81, g.x + 8, g.y + 8);
        break;
      }
      case "Flag": {
        if (g.shouldShowStats) {
          rectfill(32, 2, 96, 31, 0);
          spr(26, 55, 6);
          print("x" + g.score, 64, 9, 7);
          timeElapsedDraw(gameState.timeElapsed, 49, 16);
          print("deaths:" + gameState.deathCount, 48, 24, 7);
        }
        break;
      }
      case "FlyFruit": {
        let off = 0;
        if (!g.fly) {
          const dir = sin(g.step);
          if (dir < 0) {
            off = 1 + max(0, sign(g.y - g.start));
          }
        } else {
          off = (off + 0.25) % 3;
        }
        spr(45 + off, g.x - 6, g.y - 2, 1, 1, true, false);
        spr(g.sprite, g.x, g.y);
        spr(45 + off, g.x + 6, g.y - 2);
        break;
      }
      case "LifeUp": {
        g.flash += 0.5;
        print("1000", g.x - 2, g.y, 7 + (g.flash % 2));
        break;
      }
      case "Platform": {
        spr(11, g.x, g.y - 1);
        spr(12, g.x + 8, g.y - 1);
        break;
      }
      case "BigChest": {
        if (g.state === "closed") {
          spr(96, g.x, g.y);
          spr(97, g.x + 8, g.y);
        } else {
          for (let i = 0; i < g.particles.length; i++) {
            const p = g.particles[i];
            // In the new version they just use rectfill with the same params
            // https://github.com/NoelFB/Celeste/blob/master/Source/PICO-8/Classic.cs#L1099
            line(
              g.x + p.x,
              g.y + 8 - p.y,
              g.x + p.x,
              min(g.y + 8 - p.y + p.height, g.y + 8),
              7
            );
          }
        }
        spr(112, g.x, g.y + 8);
        spr(113, g.x + 8, g.y + 8);
        break;
      }
      case "Orb": {
        spr(102, g.x, g.y);
        const off = gameState.currentFrame / 30;
        for (let i = 0; i < 8; i++) {
          circfill(
            g.x + 4 + cos(off + i / 8) * 8,
            g.y + 4 + sin(off + i / 8) * 8,
            1,
            7
          );
        }
        break;
      }
      case "Message": {
        let offsetX = 8;
        let offsetY = 96;
        for (let i = 0; i < g.index; i++) {
          if (g.text[i] !== "#") {
            rectfill(offsetX - 2, offsetY - 2, offsetX + 7, offsetY + 6, 7);
            print(g.text[i], offsetX, offsetY, 0);
            offsetX += 5;
          } else {
            offsetX = 8;
            offsetY += 7;
          }
        }
        break;
      }
    }
  }
}

function sortGameObjectsByDrawOrder(gameObjects: GameObject[]) {
  // Insertion sort is faster than native sort on the array
  for (let i = 1; i < gameObjects.length; i++) {
    const current = gameObjects[i];
    let j = i - 1;
    while (j >= 0 && gameObjects[j].drawOrder > current.drawOrder) {
      gameObjects[j + 1] = gameObjects[j];
      j--;
    }
    gameObjects[j + 1] = current;
  }
}

function getGameObjectOfType(type: string): GameObject | null {
  const gs = getGameObjectsOfType(type);
  for (const g of gs) return g;
  return null;
}

function getGameObjectsOfType(type: string): GameObject[] {
  const gs = gameState.gameObjectsByType.get(type);
  return gs ?? [];
}

function gameObjectFirstCollision(
  object: GameObject,
  offsetToCheckAtX: number,
  offsetToCheckAtY: number,
  objectsToCheckAgainst: (GameObject | null)[]
): GameObject | null {
  for (let i = 0; i < objectsToCheckAgainst.length; i++) {
    const other = objectsToCheckAgainst[i];
    if (
      other !== null &&
      object !== other &&
      other.isCollidable &&
      other.x + other.hitboxX + other.hitboxW >
        object.x + object.hitboxX + offsetToCheckAtX &&
      other.y + other.hitboxY + other.hitboxH >
        object.y + object.hitboxY + offsetToCheckAtY &&
      other.x + other.hitboxX <
        object.x + object.hitboxX + object.hitboxW + offsetToCheckAtX &&
      other.y + other.hitboxY <
        object.y + object.hitboxY + object.hitboxH + offsetToCheckAtY
    ) {
      return other;
    }
  }
  return null;
}

function gameObjectMoveX(object: GameObject, amount: number, startAt: number) {
  if (object.isSolid) {
    const step = sign(amount);
    for (let i = startAt; i <= abs(amount); i++) {
      if (!gameObjectCollidesWithSolid(object, step, 0)) {
        object.x += step;
      } else {
        object.speedX = 0;
        object.movementReminderX = 0;
        break;
      }
    }
  } else {
    object.x += amount;
  }
}

function gameObjectCollidesWithSolid(
  object: GameObject,
  offsetToCheckAtX: number,
  offsetToCheckAtY: number
): boolean {
  if (
    offsetToCheckAtY > 0 &&
    gameObjectFirstCollision(
      object,
      offsetToCheckAtX,
      0,
      getGameObjectsOfType("Platform")!
    ) === null &&
    gameObjectFirstCollision(
      object,
      offsetToCheckAtX,
      offsetToCheckAtY,
      getGameObjectsOfType("Platform")!
    ) !== null
  ) {
    return true;
  }
  const level = getGameObjectOfType("Level")!;
  return (
    rectHasFlag(
      level.tileX,
      level.tileY,
      object.x + object.hitboxX + offsetToCheckAtX,
      object.y + object.hitboxY + offsetToCheckAtY,
      object.hitboxW,
      object.hitboxH,
      FLAG_SOLID
    ) ||
    gameObjectFirstCollision(
      object,
      offsetToCheckAtX,
      offsetToCheckAtY,
      getGameObjectsOfType("FallFloor")!
    ) !== null ||
    gameObjectFirstCollision(
      object,
      offsetToCheckAtX,
      offsetToCheckAtY,
      getGameObjectsOfType("FakeWall")!
    ) !== null
  );
}

function gameObjectCollidesWithIce(
  object: GameObject,
  offsetToCheckAtX: number,
  offsetToCheckAtY: number
) {
  const x = object.x + object.hitboxX + offsetToCheckAtX;
  const y = object.y + object.hitboxY + offsetToCheckAtY;
  const w = object.hitboxW;
  const h = object.hitboxH;
  const level = getGameObjectOfType("Level")!;
  return rectHasFlag(level.tileX, level.tileY, x, y, w, h, FLAG_ICE);
}

function createLevel(id: number) {
  const level = createGameObject("Level");
  level.id = id;
  level.tileX = (level.id % MAP_W_SCENES) * SCENE_W_TILES;
  level.tileY = flr(level.id / MAP_W_SCENES) * SCENE_H_TILES;
  level.drawOrder = 10;

  const layers = [4, 8, 2]; // bg, fg, main terrain -> stored in the id
  for (let i = 0; i < 3; i++) {
    const terrain = createGameObject("Terrain");
    terrain.id = layers[i];
    terrain.drawOrder = -8 + i;
    terrain.parent = level;
    terrain.parent.children.push(terrain);
  }

  const tileIdToCreateMethod = {
    1: createPlayerSpawner,
    8: createKey,
    11: createPlatformRight,
    12: createPlatformLeft,
    18: createSpring,
    20: createChest,
    22: createBalloon,
    23: createFallFloor,
    26: createFruit,
    28: createFlyFruit,
    64: createFakeWall,
    86: createMessage,
    96: createBigChest,
    118: createFlag,
  };
  const fruitRelatedTileIds = [8, 20, 26, 28, 64];
  for (let x = 0; x < SCENE_W_TILES; x++) {
    for (let y = 0; y < SCENE_H_TILES; y++) {
      const tile = mget(level.tileX + x, level.tileY + y);
      // do not add fruit or chest or key if already picked up or lost the chance
      if (
        gameState.pickedFruitInLevel[id] &&
        fruitRelatedTileIds.includes(tile)
      ) {
        continue;
      }

      if (tile in tileIdToCreateMethod) {
        const xInPx = x * SPRITE_W;
        const yInPx = y * SPRITE_W;
        const created = tileIdToCreateMethod[
          tile as keyof typeof tileIdToCreateMethod
        ](xInPx, yInPx);
        created.parent = level;
        created.parent.children.push(created);
      }
    }
  }

  return level;
}

function createHairs(parent: GameObject) {
  const hairs = createGameObject("Hairs");
  hairs.x = parent.x;
  hairs.y = parent.y;
  hairs.parent = parent;
  hairs.parent.children.push(hairs);
  for (let i = 0; i <= 4; i++) {
    const hair = createGameObject("Hair");
    hair.x = parent.x;
    hair.y = parent.y;
    hair.radius = max(1, min(2, 3 - i));
    hair.color = 8; // Color.Red
    hair.drawOrder = -1;
    hair.parent = hairs;
    hair.parent.children.push(hair);
  }
}

function createPlayer(x: number, y: number) {
  const player = createGameObject("Player");
  player.x = x;
  player.y = y;
  player.isSolid = true;

  player.hitboxX = 1;
  player.hitboxY = 3;
  player.hitboxW = 6;
  player.hitboxH = 5;
  player.sprite = 1;

  if (gameState.useOrbBackground) {
    player.maxDashJumpsCount += 1;
  }

  createHairs(player);
}

function destroyPlayer(player: GameObject) {
  gameState.timers["mutePsfxs"] = 12;
  sfx("died");
  gameState.deathCount += 1;
  gameState.timers["shake"] = 10;
  destroyGameObject(player);
  createDeathParticles(player.x + SPRITE_W / 2, player.y + SPRITE_W / 2);
}

function createPlayerSpawner(x: number, y: number) {
  const playerSpawner = createGameObject("PlayerSpawner");
  playerSpawner.x = x;
  playerSpawner.y = SCREEN_H;
  playerSpawner.sprite = 3;
  playerSpawner.speedY = -4;
  playerSpawner.targetX = x;
  playerSpawner.targetY = y;
  playerSpawner.state = "GoingUp";
  createHairs(playerSpawner);
  sfx("playerSpawnerCreated");
  return playerSpawner;
}

function createSmoke(x: number, y: number) {
  const smoke = createGameObject("Smoke");
  smoke.sprite = 29;
  smoke.speedY = -0.1;
  smoke.speedX = 0.3 + rnd(0.2);
  smoke.x = x + -1 + rnd(2);
  smoke.y = y - 1 + rnd(2);
  smoke.flipX = rnd() < 0.5;
  smoke.flipY = rnd() < 0.5;
  return smoke;
}

function createSpring(x: number, y: number) {
  const spring = createGameObject("Spring");
  spring.x = x;
  spring.y = y;
  spring.sprite = 18;
  spring.hideIn = 0;
  spring.hideFor = 0;
  spring.delay = 0;
  return spring;
}

function createBalloon(x: number, y: number) {
  const balloon = createGameObject("Balloon");
  balloon.sprite = 22;
  balloon.x = x;
  balloon.y = y;
  balloon.hitboxX = -1;
  balloon.hitboxY = -1;
  balloon.hitboxW = 10;
  balloon.hitboxH = 10;
  balloon.offset = rnd(1);
  balloon.start = y;
  balloon.timer = 0;
  return balloon;
}

function createFallFloor(x: number, y: number) {
  const fallFloor = createGameObject("FallFloor");
  fallFloor.x = x;
  fallFloor.y = y;
  fallFloor.state = "idle";
  fallFloor.delay = 0;
  fallFloor.sprite = 23;
  return fallFloor;
}

function fallFloorBreak(fallFloor: GameObject) {
  if (fallFloor.state !== "idle") return;
  psfx("fallFloorShakeStarted");
  fallFloor.state = "shaking";
  fallFloor.delay = 15; // how long until it falls
  createSmoke(fallFloor.x, fallFloor.y);
  const springs = getGameObjectsOfType("Spring");
  const spring = gameObjectFirstCollision(fallFloor, 0, -1, springs);
  if (spring) {
    spring.hideIn = 15;
  }
}

function createFruit(x: number, y: number) {
  const fruit = createGameObject("Fruit");
  fruit.sprite = 26;
  fruit.x = x;
  fruit.y = y;
  fruit.start = y;
  fruit.off = 0;
  return fruit;
}

function createFlyFruit(x: number, y: number) {
  const flyFruit = createGameObject("FlyFruit");
  flyFruit.sprite = 28;
  flyFruit.x = x;
  flyFruit.y = y;
  flyFruit.start = y;
  flyFruit.fly = false;
  flyFruit.step = 0.5;
  flyFruit.sfxDelay = 8;
  return flyFruit;
}

function createLifeUp(x: number, y: number) {
  const lifeUp = createGameObject("LifeUp");
  lifeUp.x = x - 2;
  lifeUp.y = y - 4;
  lifeUp.speedY = -0.25;
  lifeUp.maxAgeInFrames = 30;
  lifeUp.flash = 0;
  return lifeUp;
}

function createFakeWall(x: number, y: number) {
  const fakeWall = createGameObject("FakeWall");
  fakeWall.x = x;
  fakeWall.y = y;
  fakeWall.sprite = 64;
  // TODO: why not solid?
  return fakeWall;
}

function createKey(x: number, y: number) {
  const key = createGameObject("Key");
  key.sprite = 8;
  key.x = x;
  key.y = y;
  return key;
}

function createChest(x: number, y: number) {
  const chest = createGameObject("Chest");
  chest.sprite = 20;
  chest.x = x - 4;
  chest.y = y;
  chest.start = chest.x;
  chest.timer = 20;
  return chest;
}

function createPlatformLeft(x: number, y: number) {
  return createPlatform(x, y, 1);
}
function createPlatformRight(x: number, y: number) {
  return createPlatform(x, y, -1);
}
function createPlatform(x: number, y: number, direction: number) {
  const platform = createGameObject("Platform");
  platform.drawOrder = -7;
  platform.x = x - 4;
  platform.y = y;
  platform.hitboxW = 16;
  platform.direction = direction;
  platform.last = x - 4;
  return platform;
}

function createMessage(x: number, y: number) {
  const message = createGameObject("Message");
  message.x = x;
  message.y = y;
  message.text =
    "-- celeste mountain --#this memorial to those# perished on the climb";
  message.index = 0;
  message.last = 0;
  return message;
}

function createBigChest(x: number, y: number) {
  const bigChest = createGameObject("BigChest");
  bigChest.x = x;
  bigChest.y = y;
  bigChest.sprite = 96;
  bigChest.hitboxW = 16;
  bigChest.t = 60;
  bigChest.particles = []; // TODO: replace with child game objects
  bigChest.state = "closed";
  return bigChest;
}

function createOrb(x: number, y: number) {
  const orb = createGameObject("Orb");
  orb.x = x;
  orb.y = y;
  orb.speedY = -4;
  return orb;
}

function createFlag(x: number, y: number) {
  const flag = createGameObject("Flag");
  flag.x = x + 5;
  flag.y = y;
  flag.sprite = 118;
  flag.score = 0;
  flag.shouldShowStats = false;

  for (let i = 1; i < gameState.pickedFruitInLevel.length; i++) {
    if (gameState.pickedFruitInLevel[i]) {
      flag.score += 1;
    }
  }
  return flag;
}

type TimeElapsed = {
  epoch: number;
  seconds: number;
  minutes: number;
  hours: number;
};

function timeElapsedDraw(timeElapsed: TimeElapsed, x: number, y: number) {
  const s = timeElapsed.seconds;
  const m = timeElapsed.minutes;
  const h = timeElapsed.hours;

  rectfill(x, y, x + 32, y + 6, 0);
  print(
    ((h < 10 && "0" + h) || h) +
      ":" +
      ((m < 10 && "0" + m) || m) +
      ":" +
      ((s < 10 && "0" + s) || s),
    x + 1,
    y + 1,
    7
  );
}

function createDeathParticles(x: number, y: number) {
  const deathParticles = createGameObject("DeathParticles");
  deathParticles.maxAgeInFrames = 10;
  for (let dir = 0; dir < 8; dir++) {
    const deathParticle = createGameObject("DeathParticle");
    deathParticle.parent = deathParticles;
    deathParticle.parent.children.push(deathParticle);
    const angle = dir / 8; // [0, 1/8, 2/8, 3/8, 4/8, 5/8, 6/8, 7/8]
    deathParticle.x = x;
    deathParticle.y = y;
    deathParticle.speedX = sin(angle) * 3;
    deathParticle.speedY = cos(angle) * 3;
    deathParticle.maxAgeInFrames = 10;
    deathParticle.usePositionAsCenter = true;
  }
}
function createSnowParticles() {
  const snowParticlesCount = 25;
  for (let i = 0; i < snowParticlesCount; i++) {
    const snowParticle = createGameObject("SnowParticle");
    snowParticle.x = rnd(SCREEN_W);
    snowParticle.y = rnd(SCREEN_H);
    snowParticle.speedX = 0.25 + rnd(5); // [0.25, 5.25)
    snowParticle.rectWidth = flr(rnd(5) / 4);
    snowParticle.color = 6 + flr(rnd(2)); // [6, 7]
    snowParticle.drawOrder = 9;
  }
}

function createClouds() {
  const cloudCount = 17;
  for (let i = 0; i < cloudCount; i++) {
    const cloud = createGameObject("Cloud");
    cloud.x = rnd(SCREEN_W);
    cloud.y = rnd(SCREEN_H);
    cloud.speedX = 1 + rnd(5); // [1..5)
    cloud.rectWidth = 32 + rnd(32); // [32..64)
    cloud.rectHeight = 4 + rnd(6); // [4..10)
    cloud.drawOrder = -9;
  }
  return getGameObjectsOfType("Cloud");
}

function psfx(name: SfxName) {
  if (gameState.timers["mutePsfxs"] <= 0) {
    sfx(name);
  }
}

// all parameters are in screen space (pixels)
function rectHasFlag(
  tileX: number,
  tileY: number,
  x: number,
  y: number,
  w: number,
  h: number,
  flag: number
) {
  const firstTileX = max(0, flr(x / SPRITE_W));
  const lastTileX = min(SCENE_W_TILES - 1, (x + w - 1) / SPRITE_W);
  const firstTileY = max(0, flr(y / SPRITE_W));
  const lastTileY = min(SCENE_H_TILES - 1, (y + h - 1) / SPRITE_W);
  for (let i = firstTileX; i <= lastTileX; i++) {
    for (let j = firstTileY; j <= lastTileY; j++) {
      const tile = mget(tileX + i, tileY + j);
      if (fget(tile, flag)) {
        return true;
      }
    }
  }
  return false;
}

function spikesAt(
  tileX: number,
  tileY: number,
  x: number,
  y: number,
  w: number,
  h: number,
  xspd: number,
  yspd: number
) {
  for (let i = max(0, flr(x / 8)); i <= min(15, (x + w - 1) / 8); i++) {
    for (let j = max(0, flr(y / 8)); j <= min(15, (y + h - 1) / 8); j++) {
      const tile = mget(tileX + i, tileY + j);
      if (
        tile === 17 &&
        ((y + h - 1) % 8 >= 6 || y + h == j * 8 + 8) &&
        yspd >= 0
      ) {
        return true;
      } else if (tile === 27 && y % 8 <= 2 && yspd <= 0) {
        return true;
      } else if (tile === 43 && x % 8 <= 2 && xspd <= 0) {
        return true;
      } else if (
        tile == 59 &&
        ((x + w - 1) % 8 >= 6 || x + w == i * 8 + 8) &&
        xspd >= 0
      ) {
        return true;
      }
    }
  }
  return false;
}

// -- helper functions --
// ----------------------

function adjustValueWithinRange(
  originalValue: number,
  rangeLimit: number,
  adjustmentAmount: number
) {
  console.assert(adjustmentAmount > 0);
  if (originalValue > rangeLimit) {
    return Math.max(originalValue - adjustmentAmount, rangeLimit);
  } else {
    return Math.min(originalValue + adjustmentAmount, rangeLimit);
  }
}

export { start };

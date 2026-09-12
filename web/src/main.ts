import * as THREE from "three";
import { SparkRenderer } from "@sparkjsdev/spark";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RapierPhysics } from "three/addons/physics/RapierPhysics.js";
import { spawnAngularVelocity, spawnPosition, spawnRotation, spawnVelocity } from "./falling";
import { Qiitan, loadQiitanShape } from "./qiitan";

// 表示する 3DGS データ。Vite の base からの相対パスで解決する
const SPLAT_URL = `${import.meta.env.BASE_URL}models/butterfly.spz`;
// Qiitan の最長辺をこの大きさに揃える
const QIITAN_SIZE = 1.8;
// 読み込み完了時に自動で降らせる数と、その間隔。URL の initial パラメータで上書きできる
const INITIAL_COUNT = Number(new URLSearchParams(location.search).get("initial") ?? 10);
const INITIAL_INTERVAL_MS = 150;
// 同時に存在できる Qiitan の数。超えた分は古いものから再利用する。
// 1 体あたり約 18 万スプラットあるため、描画負荷を抑えるために控えめにする
const MAX_QIITAN = 16;
// 少し上から見下ろし、床が奥へ続いて見えるようにする
const CAMERA_FOV = 50;
const CAMERA_POSITION = { x: 0, y: 2.5, z: 8 };
const CAMERA_TARGET = { x: 0, y: 0.5, z: 0 };
// カメラを近づけすぎたり離しすぎたりしない範囲
const CAMERA_MIN_DISTANCE = 3;
const CAMERA_MAX_DISTANCE = 20;
// カメラが壁の外側に回ったときの壁の不透明度
const WALL_OUTSIDE_OPACITY = 0.3;
// 床の上面の高さ
const FLOOR_Y = -1.5;
// 壁で囲った部屋。奥行きを区切り、Qiitan が視界の外へ転がらないようにする。
// 床は手前の断面が画面に映らないよう、見えない前壁より手前まで延ばす
const ROOM = { halfWidth: 5, backZ: -6, frontZ: 2, floorFrontZ: 5, wallHeight: 4.5 };
// 壁紙と床材。1 枚を何メートル四方として敷き詰めるか
const TEXTURE_DIR = `${import.meta.env.BASE_URL}textures/`;
const WALLPAPER_TILE = 2;
const FLOOR_TILE = 2.5;
// 落下位置に使う奥行きの範囲。壁から少し内側にする
const DEPTH_RANGE = { minZ: ROOM.backZ + 1, maxZ: ROOM.frontZ - 1 };
const MASS = 1;
const RESTITUTION = 0.4;
const MAX_SIDEWAYS_SPEED = 0.8;
const MAX_SPIN = 4;

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const dropButton = document.querySelector<HTMLButtonElement>("#drop")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

// Spark はアンチエイリアスを使うと大きく遅くなるため、必ず無効にする
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
// スマホで描画が重くなるのを避けるため、解像度の上限を抑える
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f5f8f3");
// 全体で描画するスプラット数に上限を設け、体数が増えても負荷が一定になるようにする。
// 上限を超えた分は Spark の LOD が小さく見えるスプラットから間引く
const LOD_SPLAT_BUDGET = 800_000;
scene.add(new SparkRenderer({ renderer, lodSplatCount: LOD_SPLAT_BUDGET }));

const camera = new THREE.PerspectiveCamera(
  CAMERA_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);

// マウスとタッチでカメラを回す、寄せる、ずらす。床の下へは回り込めないようにする
const controls = new OrbitControls(camera, canvas);
controls.target.set(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
controls.enableDamping = true;
controls.minDistance = CAMERA_MIN_DISTANCE;
controls.maxDistance = CAMERA_MAX_DISTANCE;
controls.maxPolarAngle = Math.PI / 2;
controls.update();

// 壁と、カメラがその壁の外側にいるかの判定。外側にいる間は半透明にして室内を見せる
const walls: { material: THREE.MeshLambertMaterial; isCameraOutside: () => boolean }[] = [];

function updateWallOpacity(): void {
  for (const wall of walls) {
    const target = wall.isCameraOutside() ? WALL_OUTSIDE_OPACITY : 1;
    wall.material.opacity = THREE.MathUtils.lerp(wall.material.opacity, target, 0.15);
  }
}

const qiitans: Qiitan[] = [];
let nextIndex = 0;

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

const textureLoader = new THREE.TextureLoader();

// 画像を tile メートル四方として、幅 width 高さ height の面に敷き詰めるテクスチャ
function tiledTexture(url: string, width: number, height: number, tile: number): THREE.Texture {
  const texture = textureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / tile, height / tile);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 見えない箱を当たり判定として質量 0 で登録する
function addStaticBox(
  physics: Awaited<ReturnType<typeof RapierPhysics>>,
  size: THREE.Vector3,
  position: THREE.Vector3,
): void {
  const collider = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z));
  collider.visible = false;
  collider.position.copy(position);
  scene.add(collider);
  physics.addMesh(collider, 0, RESTITUTION);
}

// 床と壁を作る。壁紙と床材を貼り、照明で陰影を付けて部屋らしく見せる。
// 当たり判定は壁より高い見えない箱で登録して、上から飛び越えないようにする
function buildRoom(physics: Awaited<ReturnType<typeof RapierPhysics>>): void {
  const width = ROOM.halfWidth * 2;
  const depth = ROOM.frontZ - ROOM.backZ;
  const centerZ = (ROOM.frontZ + ROOM.backZ) / 2;
  const colliderHeight = 20;

  scene.add(new THREE.HemisphereLight("#ffffff", "#8c8a80", 2.0));
  const sun = new THREE.DirectionalLight("#fff8ee", 1.0);
  sun.position.set(-4, 6, 5);
  scene.add(sun);

  const wallpaper = `${TEXTURE_DIR}wallpaper.jpg`;
  const floorDepth = ROOM.floorFrontZ - ROOM.backZ;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 1, floorDepth),
    new THREE.MeshLambertMaterial({
      map: tiledTexture(`${TEXTURE_DIR}wood-floor.jpg`, width, floorDepth, FLOOR_TILE),
    }),
  );
  floor.position.set(0, FLOOR_Y - 0.5, (ROOM.floorFrontZ + ROOM.backZ) / 2);
  scene.add(floor);
  physics.addMesh(floor, 0, RESTITUTION);

  const wallCenterY = FLOOR_Y + ROOM.wallHeight / 2;
  // 壁ごとに不透明度を変えるので、材質は共有しない。
  // 外側から見たときも半透明の壁として見えるよう、両面を描画する
  function wallMaterial(faceWidth: number): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({
      map: tiledTexture(wallpaper, faceWidth, ROOM.wallHeight, WALLPAPER_TILE),
      transparent: true,
      side: THREE.DoubleSide,
    });
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, ROOM.wallHeight), wallMaterial(width));
  back.position.set(0, wallCenterY, ROOM.backZ);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(depth, ROOM.wallHeight), wallMaterial(depth));
  left.position.set(-ROOM.halfWidth, wallCenterY, centerZ);
  left.rotation.y = Math.PI / 2;
  const right = new THREE.Mesh(new THREE.PlaneGeometry(depth, ROOM.wallHeight), wallMaterial(depth));
  right.position.set(ROOM.halfWidth, wallCenterY, centerZ);
  right.rotation.y = -Math.PI / 2;
  scene.add(back, left, right);
  walls.push(
    { material: back.material, isCameraOutside: () => camera.position.z < ROOM.backZ },
    { material: left.material, isCameraOutside: () => camera.position.x < -ROOM.halfWidth },
    { material: right.material, isCameraOutside: () => camera.position.x > ROOM.halfWidth },
  );

  const colliderY = FLOOR_Y + colliderHeight / 2;
  addStaticBox(physics, new THREE.Vector3(width + 1, colliderHeight, 0.5), new THREE.Vector3(0, colliderY, ROOM.backZ - 0.25));
  addStaticBox(physics, new THREE.Vector3(width + 1, colliderHeight, 0.5), new THREE.Vector3(0, colliderY, ROOM.frontZ + 0.25));
  addStaticBox(physics, new THREE.Vector3(0.5, colliderHeight, depth + 1), new THREE.Vector3(-ROOM.halfWidth - 0.25, colliderY, centerZ));
  addStaticBox(physics, new THREE.Vector3(0.5, colliderHeight, depth + 1), new THREE.Vector3(ROOM.halfWidth + 0.25, colliderY, centerZ));

  buildSofa(physics, centerZ);
}

// 白い箱を組み合わせたソファーを部屋の中央に置く。各パーツをそのまま当たり判定にする
function buildSofa(physics: Awaited<ReturnType<typeof RapierPhysics>>, z: number): void {
  const material = new THREE.MeshLambertMaterial({ color: "#f6f5f0" });
  const seat = { width: 3, height: 0.45, depth: 1.8, bottom: FLOOR_Y + 0.15 };
  const armWidth = 0.3;
  const backDepth = 0.3;
  const parts: { size: THREE.Vector3; position: THREE.Vector3 }[] = [
    {
      size: new THREE.Vector3(seat.width, seat.height, seat.depth),
      position: new THREE.Vector3(0, seat.bottom + seat.height / 2, z),
    },
    {
      size: new THREE.Vector3(seat.width, 0.8, backDepth),
      position: new THREE.Vector3(0, seat.bottom + 0.4, z - seat.depth / 2 + backDepth / 2),
    },
    {
      size: new THREE.Vector3(armWidth, 0.65, seat.depth),
      position: new THREE.Vector3(-seat.width / 2 - armWidth / 2, seat.bottom + 0.325, z),
    },
    {
      size: new THREE.Vector3(armWidth, 0.65, seat.depth),
      position: new THREE.Vector3(seat.width / 2 + armWidth / 2, seat.bottom + 0.325, z),
    },
  ];
  // 背もたれは座面の上に載せるので、座面の高さ分だけ持ち上げる
  parts[1].position.y = seat.bottom + seat.height + 0.4;
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      parts.push({
        size: new THREE.Vector3(0.1, 0.15, 0.1),
        position: new THREE.Vector3(dx * (seat.width / 2 - 0.15), FLOOR_Y + 0.075, z + dz * (seat.depth / 2 - 0.15)),
      });
    }
  }
  for (const { size, position } of parts) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(position);
    scene.add(mesh);
    physics.addMesh(mesh, 0, RESTITUTION);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const [physics, shape] = await Promise.all([RapierPhysics(), loadQiitanShape(SPLAT_URL, QIITAN_SIZE)]);

  buildRoom(physics);

  const halfSize = Math.max(shape.size.x, shape.size.y, shape.size.z) / 2;
  // カメラをどこへ回しても壁の上から現れるよう、壁の上端を基準にして落とす
  const spawnArea = {
    ...DEPTH_RANGE,
    halfWidth: ROOM.halfWidth - halfSize,
    topY: FLOOR_Y + ROOM.wallHeight,
    margin: halfSize * 2,
  };

  function drop(): void {
    let qiitan = qiitans[nextIndex];
    if (!qiitan) {
      qiitan = new Qiitan(shape, physics, MASS, RESTITUTION);
      qiitans.push(qiitan);
      scene.add(qiitan.group, qiitan.body);
    }
    nextIndex = (nextIndex + 1) % MAX_QIITAN;

    qiitan.drop(
      physics,
      spawnPosition(Math.random, spawnArea),
      spawnRotation(Math.random),
      spawnVelocity(Math.random, MAX_SIDEWAYS_SPEED),
      spawnAngularVelocity(Math.random, MAX_SPIN),
    );
    status.textContent = `${qiitans.length} 体`;
  }

  renderer.setAnimationLoop(() => {
    for (const qiitan of qiitans) {
      qiitan.sync();
    }
    controls.update();
    updateWallOpacity();
    renderer.render(scene, camera);
  });

  dropButton.addEventListener("click", drop);
  dropButton.disabled = false;
  dropButton.textContent = "Qiitan を降らせる";

  // 最初から賑やかに見えるよう、間隔をあけて自動で降らせる
  for (let i = 0; i < INITIAL_COUNT; i++) {
    drop();
    await sleep(INITIAL_INTERVAL_MS);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  dropButton.textContent = "読み込みに失敗しました";
  status.textContent = error instanceof Error ? error.message : String(error);
});

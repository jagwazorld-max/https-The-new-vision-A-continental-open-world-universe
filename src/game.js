import * as THREE from "three";

const canvas = document.querySelector("#world");
const loading = document.querySelector("#loading");
const intro = document.querySelector("#intro");
const hud = document.querySelector("#hud");
const pauseScreen = document.querySelector("#pause-screen");
const errorMessage = document.querySelector("#error-message");
const cashLabel = document.querySelector("#cash");
const speedLabel = document.querySelector("#speed");
const objectiveLabel = document.querySelector("#objective");

let scene, camera, renderer, player, vehicle, clock;
let running = false;
let paused = false;
let speed = 0;
const keys = new Set();
const world = { district: "Western Coast · Central District", cash: 2500, visited: false };
const clamp = THREE.MathUtils.clamp;

function material(color, roughness = 0.88) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}
function box(parent, x, y, z, sx, sy, sz, mat, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function makeBuilding(x, z, w, d, h, seed) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const palette = [0xb8a58a, 0x9eaa9e, 0xc5bba6, 0x8e9999, 0xc3a58a, 0x777e7b];
  const base = material(palette[seed % palette.length]);
  box(group, 0, h / 2, 0, w, h, d, base);
  const roof = material(0x555d5c);
  box(group, 0, h + .12, 0, w + .12, .24, d + .12, roof, false);
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x253b46, roughness: .32, metalness: .12 });
  const rows = Math.max(1, Math.floor(h / 2.2));
  const cols = Math.max(1, Math.floor(w / 1.8));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = -w / 2 + .75 + col * ((w - 1) / cols);
      const wy = 1.05 + row * 2.05;
      if (wy < h - .5) {
        box(group, wx, wy, d / 2 + .012, .48, .72, .035, windowMat, false);
        box(group, wx, wy, -d / 2 - .012, .48, .72, .035, windowMat, false);
      }
    }
  }
  scene.add(group);
}
function makeTree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.13 * scale, .2 * scale, 1.5 * scale, 7), material(0x705039));
  trunk.position.y = .75 * scale;
  group.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.85 * scale, 1), material(0x47734c));
  crown.position.y = 1.85 * scale;
  crown.scale.set(1, 1.15, 1);
  group.add(crown);
  scene.add(group);
}
function makeCar() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, .62, 3.8), material(0xb38b48, .45));
  body.position.y = .72;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.52, .72, 1.8), material(0x263a43, .28));
  cabin.position.set(0, 1.34, -.18);
  cabin.castShadow = true;
  group.add(cabin);
  const tireMat = material(0x171a1b);
  for (const x of [-.98, .98]) for (const z of [-1.2, 1.2]) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .22, 12), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, .42, z);
    group.add(tire);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffe4a0, emissive: 0x77501a });
  for (const x of [-.62, .62]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(.35, .16, .05), lightMat);
    light.position.set(x, .76, 1.93);
    group.add(light);
  }
  group.position.set(0, 0, 9);
  scene.add(group);
  return group;
}
function buildWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cb6c0);
  scene.fog = new THREE.Fog(0x9cb6c0, 65, 190);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 300);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const hemi = new THREE.HemisphereLight(0xe6f0ef, 0x6d604b, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0b3, 3.1);
  sun.position.set(-35, 65, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), material(0x9c9a79));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const roadMat = material(0x343a3d);
  const roadLine = new THREE.MeshBasicMaterial({ color: 0xd5c9a0 });
  for (let i = -4; i <= 4; i++) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 240), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(i * 32, .015, 0); scene.add(road);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(240, 12), roadMat);
    cross.rotation.x = -Math.PI / 2; cross.position.set(0, .016, i * 32); scene.add(cross);
    for (let n = -10; n <= 10; n++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(.18, 3), roadLine);
      dash.rotation.x = -Math.PI / 2; dash.position.set(i * 32, .03, n * 11); scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(3, .18), roadLine);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(n * 11, .031, i * 32); scene.add(dash2);
    }
  }
  let seed = 17;
  const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
    if (random() < .17) continue;
    const cx = x * 32 + (random() - .5) * 7;
    const cz = z * 32 + (random() - .5) * 7;
    if (Math.abs(cx) < 13 || Math.abs(cz) < 13) continue;
    makeBuilding(cx, cz, 8 + random() * 7, 8 + random() * 7, 5 + random() * 17, Math.floor(random() * 20));
  }
  for (let i = 0; i < 42; i++) {
    const x = (random() - .5) * 210, z = (random() - .5) * 210;
    if (Math.abs(x % 32) < 9 || Math.abs(z % 32) < 9) continue;
    makeTree(x, z, .7 + random() * .8);
  }
  // Coastal water and a promenade at the edge of the starter district.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 90), new THREE.MeshStandardMaterial({ color: 0x477e8a, roughness: .25, metalness: .08 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -.08, -160); scene.add(water);
  const shore = new THREE.Mesh(new THREE.PlaneGeometry(240, 12), material(0xc2ad82));
  shore.rotation.x = -Math.PI / 2; shore.position.set(0, -.01, -112); scene.add(shore);
  vehicle = makeCar();
  player = { position: vehicle.position.clone(), heading: 0 };
  clock = new THREE.Clock();
}
function update(delta) {
  if (!running || paused) return;
  const forward = keys.has("KeyW") || keys.has("ArrowUp");
  const reverse = keys.has("KeyS") || keys.has("ArrowDown");
  const left = keys.has("KeyA") || keys.has("ArrowLeft");
  const right = keys.has("KeyD") || keys.has("ArrowRight");
  const braking = keys.has("Space");
  const target = forward ? 26 : reverse ? -12 : 0;
  speed = THREE.MathUtils.damp(speed, braking ? 0 : target, 2.8, delta);
  const steer = (right ? 1 : 0) - (left ? 1 : 0);
  if (Math.abs(speed) > .25) vehicle.rotation.y -= steer * delta * 1.7 * Math.sign(speed) * Math.min(1, Math.abs(speed) / 8);
  const direction = new THREE.Vector3(Math.sin(vehicle.rotation.y), 0, Math.cos(vehicle.rotation.y));
  vehicle.position.addScaledVector(direction, speed * delta);
  vehicle.position.x = clamp(vehicle.position.x, -112, 112);
  vehicle.position.z = clamp(vehicle.position.z, -105, 112);
  player.position.copy(vehicle.position);
  const cameraOffset = new THREE.Vector3(0, 7.2, -12).applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.rotation.y);
  const desired = vehicle.position.clone().add(cameraOffset);
  camera.position.lerp(desired, 1 - Math.pow(.001, delta));
  camera.lookAt(vehicle.position.x, 1.1, vehicle.position.z);
  speedLabel.textContent = String(Math.round(Math.abs(speed) * 3.6));
  if (!world.visited && vehicle.position.length() > 28) {
    world.visited = true;
    objectiveLabel.textContent = "District discovered";
    cashLabel.textContent = world.cash.toLocaleString();
  }
}
function frame() {
  requestAnimationFrame(frame);
  const delta = Math.min(clock ? clock.getDelta() : .016, .05);
  update(delta);
  if (renderer && scene && camera) renderer.render(scene, camera);
}
function setPaused(value) {
  paused = value;
  pauseScreen.classList.toggle("hidden", !value);
  hud.classList.toggle("hidden", value || !running);
}
function startGame() {
  intro.classList.add("hidden");
  hud.classList.remove("hidden");
  running = true;
  setPaused(false);
  try { localStorage.setItem("crownline-save", JSON.stringify({ cash: world.cash, visited: world.visited })); } catch {}
}
window.addEventListener("keydown", event => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "Escape" && running) setPaused(!paused);
});
window.addEventListener("keyup", event => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", () => {
  if (!camera || !renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});
document.querySelector("#start-button").addEventListener("click", startGame);
document.querySelector("#pause-button").addEventListener("click", () => { if (running) setPaused(true); });
document.querySelector("#resume-button").addEventListener("click", () => setPaused(false));
try {
  buildWorld();
  try {
    const saved = JSON.parse(localStorage.getItem("crownline-save") || "null");
    if (saved) { world.cash = Number(saved.cash) || 2500; world.visited = Boolean(saved.visited); cashLabel.textContent = world.cash.toLocaleString(); if (world.visited) objectiveLabel.textContent = "District discovered"; }
  } catch {}
  loading.classList.add("hidden");
  frame();
} catch (error) {
  console.error("CROWNLINE startup error:", error);
  loading.classList.add("hidden");
  errorMessage.classList.remove("hidden");
}
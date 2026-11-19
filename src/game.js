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
let playerMode = 'vehicle', avatar = null, missionMarker = null, missionComplete = false, missionPulse = 0;
const traffic = [];
const pedestrians = [];
const buildingBounds = [];
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
  buildingBounds.push({ minX: x - w / 2 - 1.4, maxX: x + w / 2 + 1.4, minZ: z - d / 2 - 1.8, maxZ: z + d / 2 + 1.8 });
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
function makeTrafficCar(x, z, heading, color) {
  const group = new THREE.Group();
  const paint = material(color, .42);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.7, .58, 3.25), paint);
  shell.position.y = .68; shell.castShadow = true; group.add(shell);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.35, .62, 1.55), material(0x263b45, .3));
  cabin.position.set(0, 1.24, -.15); group.add(cabin);
  const tireMat = material(0x17191a);
  for (const tx of [-.88, .88]) for (const tz of [-1.05, 1.05]) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .18, 10), tireMat);
    tire.rotation.z = Math.PI / 2; tire.position.set(tx, .35, tz); group.add(tire);
  }
  group.position.set(x, 0, z); group.rotation.y = heading; scene.add(group);
  return { mesh: group, direction: heading === 0 ? 1 : -1, laneX: x, pace: 7 + Math.random() * 5 };
}
function makePedestrian(x, z, phase) {
  const group = new THREE.Group();
  const skin = material([0x754b35, 0x9a6749, 0x593b2c, 0xb17d58][phase % 4]);
  const clothes = material([0x9b5b36, 0x315b58, 0x9a884d, 0x3f4e70][phase % 4]);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .62, 3, 7), clothes);
  body.position.y = .78; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.19, 10, 8), skin);
  head.position.y = 1.35; head.castShadow = true; group.add(head);
  group.position.set(x, 0, z); scene.add(group);
  return { mesh: group, originX: x, originZ: z, phase: phase * 1.7, pace: .45 + (phase % 3) * .12 };
}
function populateLife() {
  const colors = [0x9b4938, 0x426d80, 0x777b55, 0xd0b06b, 0x3f4449, 0x8b6d91];
  for (const lane of [-64, -32, 32, 64]) {
    traffic.push(makeTrafficCar(lane - 3.1, -95, 0, colors[traffic.length % colors.length]));
    traffic.push(makeTrafficCar(lane + 3.1, 95, Math.PI, colors[traffic.length % colors.length]));
  }
  for (let i = 0; i < 22; i++) {
    const roadIndex = Math.floor(i / 6) - 1;
    const roadX = roadIndex * 32;
    const side = i % 2 ? 1 : -1;
    const z = -88 + (i * 17) % 176;
    pedestrians.push(makePedestrian(roadX + side * 8.2, z, i));
  }
}
function collidesWithBuilding(position) {
  return buildingBounds.some(b => position.x > b.minX && position.x < b.maxX && position.z > b.minZ && position.z < b.maxZ);
}
function updateAmbientLife(delta) {
  for (const car of traffic) {
    car.mesh.position.z += car.direction * car.pace * delta;
    if (car.mesh.position.z > 118) car.mesh.position.z = -118;
    if (car.mesh.position.z < -118) car.mesh.position.z = 118;
  }
  for (const person of pedestrians) {
    const t = clock.elapsedTime * person.pace + person.phase;
    person.mesh.position.x = person.originX + Math.sin(t) * 1.6;
    person.mesh.position.z = person.originZ + Math.cos(t * .7) * 2.8;
    person.mesh.rotation.y = Math.atan2(Math.cos(t), -Math.sin(t * .7));
  }
}

function makeAvatar() {
  const group = new THREE.Group();
  const skin = material(0x87583e), outfit = material(0x263f48), trousers = material(0x252b32);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.22,14,12),skin); head.position.y=1.58; group.add(head);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.28,.55,4,9),outfit); torso.position.y=1.05; group.add(torso);
  const legs=[];
  for(const x of [-.13,.13]) { const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,3,7),trousers); leg.position.set(x,.42,0); group.add(leg); legs.push(leg); }
  const arms=[];
  for(const x of [-.34,.34]) { const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.42,3,7),skin); arm.position.set(x,1.02,0); group.add(arm); arms.push(arm); }
  group.userData.limbs=[...legs,...arms]; group.visible=false; scene.add(group); return group;
}
function makeMissionMarker() {
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,.09,8,32),new THREE.MeshBasicMaterial({color:0xe5bd69})); ring.rotation.x=Math.PI/2; ring.position.y=.18; g.add(ring);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.12,3.8,10,1,true),new THREE.MeshBasicMaterial({color:0xe5bd69,transparent:true,opacity:.38})); beam.position.y=2.1; g.add(beam);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.38),new THREE.MeshStandardMaterial({color:0xffd37a,emissive:0x8b5c18})); gem.position.y=4.1; g.add(gem);
  g.position.set(18,0,30); scene.add(g); return g;
}
function saveProgress() {
  try { localStorage.setItem("crownline-save",JSON.stringify({cash:world.cash,visited:world.visited,missionComplete,playerMode,vehiclePosition:vehicle.position.toArray(),vehicleHeading:vehicle.rotation.y,playerPosition:player.position.toArray(),playerHeading:player.heading})); } catch {}
}
function exitVehicle() {
  if(playerMode!=="vehicle"||Math.abs(speed)>2.2)return;
  playerMode="foot"; speed=0;
  const side=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),vehicle.rotation.y);
  player.position.copy(vehicle.position).addScaledVector(side,2.1); player.heading=vehicle.rotation.y;
  avatar.position.copy(player.position); avatar.rotation.y=player.heading; avatar.visible=true;
}
function enterVehicle() {
  if(playerMode!=="foot"||player.position.distanceTo(vehicle.position)>4.2)return;
  playerMode="vehicle"; avatar.visible=false; player.position.copy(vehicle.position);
}
function interact() {
  if(playerMode==="foot"&&!missionComplete&&player.position.distanceTo(missionMarker.position)<3.8){
    missionComplete=true; world.cash+=500; objectiveLabel.textContent="First contact complete";
    cashLabel.textContent=world.cash.toLocaleString(); missionMarker.visible=false; saveProgress();
  }
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
  populateLife();
  player = { position: vehicle.position.clone(), heading: 0 };
  avatar = makeAvatar(); missionMarker = makeMissionMarker();
  clock = new THREE.Clock();
}

function update(delta) {
 if(!running||paused)return;
 updateAmbientLife(delta);
 if(playerMode==="vehicle"){
  const f=keys.has("KeyW")||keys.has("ArrowUp"),r=keys.has("KeyS")||keys.has("ArrowDown");
  const l=keys.has("KeyA")||keys.has("ArrowLeft"),q=keys.has("KeyD")||keys.has("ArrowRight");
  speed=THREE.MathUtils.damp(speed,keys.has("Space")?0:f?26:r?-12:0,2.8,delta);
  const steer=(q?1:0)-(l?1:0);
  if(Math.abs(speed)>.25)vehicle.rotation.y-=steer*delta*1.7*Math.sign(speed)*Math.min(1,Math.abs(speed)/8);
  const dir=new THREE.Vector3(Math.sin(vehicle.rotation.y),0,Math.cos(vehicle.rotation.y)),prev=vehicle.position.clone();
  vehicle.position.addScaledVector(dir,speed*delta); vehicle.position.x=clamp(vehicle.position.x,-112,112); vehicle.position.z=clamp(vehicle.position.z,-105,112);
  if(collidesWithBuilding(vehicle.position)){vehicle.position.copy(prev);speed=0;}
  for(const car of traffic)if(vehicle.position.distanceTo(car.mesh.position)<2.2){vehicle.position.copy(prev);speed=0;break;}
  player.position.copy(vehicle.position);
  const offset=new THREE.Vector3(0,7.2,-12).applyAxisAngle(new THREE.Vector3(0,1,0),vehicle.rotation.y);
  camera.position.lerp(vehicle.position.clone().add(offset),1-Math.pow(.001,delta)); camera.lookAt(vehicle.position.x,1.1,vehicle.position.z);
  speedLabel.textContent=String(Math.round(Math.abs(speed)*3.6));
 }else{
  const f=keys.has("KeyW")||keys.has("ArrowUp"),b=keys.has("KeyS")||keys.has("ArrowDown");
  const l=keys.has("KeyA")||keys.has("ArrowLeft"),r=keys.has("KeyD")||keys.has("ArrowRight");
  player.heading-=((r?1:0)-(l?1:0))*delta*2.35;
  const pace=keys.has("ShiftLeft")||keys.has("ShiftRight")?8.2:4.6;
  const dir=new THREE.Vector3(Math.sin(player.heading),0,Math.cos(player.heading)),prev=player.position.clone();
  player.position.addScaledVector(dir,((f?1:0)-(b?1:0))*pace*delta);
  player.position.x=clamp(player.position.x,-112,112);player.position.z=clamp(player.position.z,-105,112);
  if(collidesWithBuilding(player.position))player.position.copy(prev);
  for(const car of traffic)if(player.position.distanceTo(car.mesh.position)<1.45)player.position.copy(prev);
  avatar.position.copy(player.position);avatar.rotation.y=player.heading;
  const moving=f||b;avatar.userData.limbs.forEach((limb,i)=>{const swing=moving?Math.sin(clock.elapsedTime*(pace>6?11:7))*.42:0;limb.rotation.x=swing*(i%2?-1:1);});
  const offset=new THREE.Vector3(0,5.2,-8.5).applyAxisAngle(new THREE.Vector3(0,1,0),player.heading);
  camera.position.lerp(player.position.clone().add(offset),1-Math.pow(.001,delta));camera.lookAt(player.position.x,1.1,player.position.z);
  speedLabel.textContent="—";
 }
 if(missionMarker.visible){missionPulse+=delta;missionMarker.rotation.y+=delta*.55;missionMarker.position.y=Math.sin(missionPulse*2)*.12;}
 const pos=playerMode==="vehicle"?vehicle.position:player.position;
 if(!world.visited&&pos.length()>28){world.visited=true;if(!missionComplete)objectiveLabel.textContent="Find the gold marker on foot";saveProgress();}
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
  saveProgress();
}
window.addEventListener("keydown", event => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === "Escape" && running) setPaused(!paused);
  if (event.code === "KeyF" && running && !paused) { if(playerMode==="vehicle") exitVehicle(); else enterVehicle(); }
  if (event.code === "KeyE" && running && !paused) interact();
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
    if(saved){
      world.cash=Number(saved.cash)||2500;world.visited=Boolean(saved.visited);missionComplete=Boolean(saved.missionComplete);
      if(Array.isArray(saved.vehiclePosition))vehicle.position.fromArray(saved.vehiclePosition);
      if(Number.isFinite(saved.vehicleHeading))vehicle.rotation.y=saved.vehicleHeading;
      if(Array.isArray(saved.playerPosition))player.position.fromArray(saved.playerPosition);
      if(Number.isFinite(saved.playerHeading))player.heading=saved.playerHeading;
      if(saved.playerMode==="foot"){playerMode="foot";avatar.visible=true;avatar.position.copy(player.position);avatar.rotation.y=player.heading;}
      if(missionComplete)missionMarker.visible=false;
      cashLabel.textContent=world.cash.toLocaleString();
      if(missionComplete)objectiveLabel.textContent="First contact complete";
      else if(world.visited)objectiveLabel.textContent="Find the gold marker on foot";
    }
  } catch {}
  loading.classList.add("hidden");
  frame();
} catch (error) {
  console.error("CROWNLINE startup error:", error);
  loading.classList.add("hidden");
  errorMessage.classList.remove("hidden");
}
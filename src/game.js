import * as THREE from "three";

const canvas = document.querySelector("#world");
const loading = document.querySelector("#loading");
const intro = document.querySelector("#intro");
const hud = document.querySelector("#hud");
const pauseScreen = document.querySelector("#pause-screen");
const errorMessage = document.querySelector("#error-message");
const cashLabel = document.querySelector("#cash");
const speedLabel = document.querySelector("#speed");
const fuelLabel = document.querySelector("#fuel");
const healthLabel = document.querySelector("#health");
const objectiveLabel = document.querySelector("#objective");
const dialoguePanel = document.querySelector("#dialogue");
const dialogueSpeaker = document.querySelector("#dialogue-speaker");
const dialogueText = document.querySelector("#dialogue-text");
const dialogueAction = document.querySelector("#dialogue-action");
const minimapCanvas = document.querySelector("#minimap");
const minimapContext = minimapCanvas?.getContext("2d");

let scene, camera, renderer, player, vehicle, clock;
let running = false;
let paused = false;
let speed = 0;
let fuel = 100;
let health = 100;
const healthCapacity = 100;
const hospitalPosition = new THREE.Vector3(64,0,-40);
const fuelCapacity = 100;
let wantedLevel = 0;
let securityMissionActive = false;
let securityMissionComplete = false;
let hasStunBaton = false;
let securityTargetsRemaining = 0;
let batonCooldown = 0;
let hostileAttackCooldown = 0;
const hostiles = [];
const securityOfficerPosition = new THREE.Vector3(-80,0,-35);
let wantedTimer = 0;
let patrolCar = null;
let patrolSirenTime = 0;
const fuelStationPosition = new THREE.Vector3(-18, 0, 0);
let playerMode = 'vehicle', avatar = null, missionMarker = null, missionComplete = false, missionStage = 0, missionPulse = 0;
let dialogueActionHandler = null;
let inShop = false;
let inApartment = false;
let inPoliceStation = false;
let contractMarker = null;
let activeCityContract = -1;
let selectedCityContract = 0;
let contractRecovered = false;
const completedCityContracts = new Set();
const npcDialogueIndex = { clerk:0, doctor:0, attendant:0 };
const npcDialogue = {
 clerk:{name:"MARKET CLERK",lines:["Fresh supplies come in every morning. The Field Kits are kept on the two centre shelves.","The waterfront road is busiest around midday. Keep an eye out for delivery vans near the docks.","People say the old service yard used to store city records. Nobody goes there after dark."]},
 doctor:{name:"DR. AMINA",lines:["Welcome to the Community Clinic. We treat everyone here, whether they live in the district or are just passing through.","Drink water when you are out exploring, and do not ignore an injury. Small accidents can become serious.","The police station coordinates local assistance contracts. Ask at their operations board if you want to help the community."]},
 attendant:{name:"FUEL ATTENDANT",lines:["Welcome to CROWNLINE Fuel. Check your tank before taking a long drive outside the central district.","The coastal highway is smoother than the old service road, but watch your speed around pedestrians.","Our station stays open through the evening. A small top-up now can save you a long walk later."]}
};
const cityContracts = [
 {name:"LOST EVIDENCE",detail:"Recover a missing evidence case from the old service yard.",x:-42,z:30,reward:650},
 {name:"COMMUNITY SUPPLIES",detail:"Collect a sealed supply pack from the eastern depot.",x:50,z:-64,reward:850}
];
let ownsApartment = false;
let homeSpawn = null;
let homeUpgrades = { television: false, plant: false, artwork: false };
const homeUpgradeMeshes = {};
const apartmentDoorPosition = new THREE.Vector3(16, 0, -6.5);
const shopPosition = new THREE.Vector3(39.5, 0, 16);
const traffic = [];
const pedestrians = [];
const patrolLights = [];
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
  const baton=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.9,8),material(0x343a40));baton.rotation.z=-.22;baton.position.set(.43,.72,.18);baton.visible=false;group.add(baton);
  group.userData.stunBaton=baton;group.userData.limbs=[...legs,...arms]; group.visible=false; scene.add(group); return group;
}
function makeMissionMarker() {
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,.09,8,32),new THREE.MeshBasicMaterial({color:0xe5bd69})); ring.rotation.x=Math.PI/2; ring.position.y=.18; g.add(ring);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.12,3.8,10,1,true),new THREE.MeshBasicMaterial({color:0xe5bd69,transparent:true,opacity:.38})); beam.position.y=2.1; g.add(beam);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.38),new THREE.MeshStandardMaterial({color:0xffd37a,emissive:0x8b5c18})); gem.position.y=4.1; g.add(gem);
  g.position.set(18,0,40); scene.add(g); return g;
}

function makeStaticNpc(x,z,shirtColor=0x9b5b36) {
 const g=new THREE.Group(),skin=material(0x87583e),shirt=material(shirtColor),pants=material(0x292f35);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.27,.58,4,8),shirt);torso.position.y=1.03;g.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),skin);head.position.y=1.55;g.add(head);
 for(const side of [-1,1]){
  const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,3,7),pants);leg.position.set(side*.13,.4,0);g.add(leg);
  const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.08,.4,3,7),skin);arm.position.set(side*.32,1.02,0);arm.rotation.z=side*.12;g.add(arm);
 }
 g.position.set(x,0,z);scene.add(g);return g;
}
function showDialogue(speaker,message,action,handler=advanceMission) {
 dialogueSpeaker.textContent=speaker;dialogueText.textContent=message;dialogueAction.textContent=action;dialogueActionHandler=handler;
 dialoguePanel.classList.remove("hidden");
}
function closeDialogue(){dialoguePanel.classList.add("hidden");dialogueActionHandler=null;}
function talkToLocalNpc(id){const person=npcDialogue[id];if(!person)return;const index=npcDialogueIndex[id]||0;showDialogue(person.name,person.lines[index],"ASK ANOTHER QUESTION",()=>{npcDialogueIndex[id]=(index+1)%person.lines.length;saveProgress();talkToLocalNpc(id);});}
function advanceMission() {
 closeDialogue();
 if(missionStage===0){
  missionStage=1;missionMarker.position.set(-25,0,-42);
  objectiveLabel.textContent="Deliver the supplies to the dock worker";saveProgress();
 }else if(missionStage===1){
  missionStage=2;missionComplete=true;world.cash+=1000;missionMarker.visible=false;
  objectiveLabel.textContent="Delivery completed · $1,000 earned";
  cashLabel.textContent=world.cash.toLocaleString();saveProgress();
 }
}

function saveProgress() {
  try { localStorage.setItem("crownline-save",JSON.stringify({cash:world.cash,fuel,health,securityMissionActive,securityMissionComplete,hasStunBaton,securityTargetsRemaining,npcDialogueIndex, inPoliceStation:inPoliceStation && playerMode==="foot",activeCityContract,contractRecovered,completedCityContracts:[...completedCityContracts],wantedLevel:0,visited:world.visited,missionComplete,missionStage,supplies:world.supplies,playerMode,inShop,inApartment:inApartment && !homeSpawn,ownsApartment,homeSpawn,homeUpgrades,vehiclePosition:vehicle.position.toArray(),vehicleHeading:vehicle.rotation.y,playerPosition:player.position.toArray(),playerHeading:player.heading})); } catch {}
}
function refuelVehicle() {
 closeDialogue();
 if(fuel>=fuelCapacity){showDialogue("CROWNLINE FUEL","Your tank is already full.","CLOSE",closeDialogue);return;}
 if(world.cash<100){showDialogue("CROWNLINE FUEL","You need $100 for a fuel top-up.","CLOSE",closeDialogue);return;}
 world.cash-=100;fuel=Math.min(fuelCapacity,fuel+25);
 cashLabel.textContent=world.cash.toLocaleString();fuelLabel.textContent=Math.round(fuel)+"%";
 showDialogue("CROWNLINE FUEL","Fuel added. Your vehicle now has "+Math.round(fuel)+"% fuel remaining.","NICE",closeDialogue);saveProgress();
}
function enterApartment() {
  closeDialogue();
  inShop = false;
  inApartment = true;
  player.position.set(0, -80, 6);
  player.heading = Math.PI;
  avatar.position.copy(player.position);
  avatar.rotation.y = player.heading;
  avatar.visible = true;
  saveProgress();
}
function buyHomeUpgrade(name, cost, label) {
  closeDialogue();
  if (homeUpgrades[name]) { showDialogue("YOUR APARTMENT", label + " is already installed.", "CLOSE", closeDialogue); return; }
  if (world.cash < cost) { showDialogue("HOME FURNISHING", "You need $" + cost.toLocaleString() + " for " + label + ".", "CLOSE", closeDialogue); return; }
  world.cash -= cost; homeUpgrades[name] = true;
  if (homeUpgradeMeshes[name]) homeUpgradeMeshes[name].visible = true;
  cashLabel.textContent = world.cash.toLocaleString();
  showDialogue("HOME FURNISHING", label + " has been installed. Your upgrade is saved.", "NICE", closeDialogue);
  saveProgress();
}
function buyApartment() {
  if (world.cash < 1500) {
    showDialogue("APARTMENT LISTING", "The starter apartment costs $1,500. Complete the waterfront delivery or earn more cash first.", "CLOSE", closeDialogue);
    return;
  }
  world.cash -= 1500;
  ownsApartment = true;
  cashLabel.textContent = world.cash.toLocaleString();
  enterApartment();
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
function buyFieldKit() {
 closeDialogue();
 if(world.cash < 250) { showDialogue("CORNER MARKET","You need $250 to buy a field kit. Complete the waterfront delivery to earn more.","CLOSE",closeDialogue); return; }
 world.cash -= 250; world.supplies += 1; cashLabel.textContent=world.cash.toLocaleString();
 showDialogue("CORNER MARKET","Field kit purchased. It has been added to your local save.","GOT IT",closeDialogue);
 saveProgress();
}
function useFieldKit() {
 closeDialogue();
 if(world.supplies<1){showDialogue("INVENTORY","You do not have a Field Kit. Buy one from Corner Market.","CLOSE",closeDialogue);return;}
 if(health>=healthCapacity){showDialogue("INVENTORY","Your health is already full.","CLOSE",closeDialogue);return;}
 world.supplies-=1;health=Math.min(healthCapacity,health+40);healthLabel.textContent=Math.round(health)+"%";
 showDialogue("FIELD KIT USED","You recovered 40 health. Remaining Field Kits: "+world.supplies+".","CONTINUE",closeDialogue);saveProgress();
}
function openInventory() {
 const items="HEALTH: "+Math.round(health)+" / 100\nFIELD KITS: "+world.supplies+"\nFUEL: "+Math.round(fuel)+"%\nSTUN BATON: "+(hasStunBaton?"EQUIPPED":"NOT OWNED")+"\n"+(securityMissionActive?"SECURITY TARGETS: "+securityTargetsRemaining:"");
 showDialogue("PLAYER INVENTORY",items,"USE FIELD KIT",useFieldKit);
}
function startSecurityMission() {
 if(securityMissionComplete){showDialogue("CITY POLICE","Security contract completed. Thank you for helping keep the district safe.","CLOSE",closeDialogue);return;}
 if(securityMissionActive){showDialogue("CITY POLICE","Your assignment is active. Neutralise the remaining suspects with your non-lethal stun baton. Targets remaining: "+securityTargetsRemaining+".","UNDERSTOOD",closeDialogue);return;}
 securityMissionActive=true;hasStunBaton=true;securityTargetsRemaining=3;
 if(avatar?.userData.stunBaton)avatar.userData.stunBaton.visible=true;
 spawnSecurityTargets();
 objectiveLabel.textContent="Security contract: 3 suspects remaining · Press G to use stun baton";
 showDialogue("CITY POLICE","A security alert came from the old service yard. We need you to safely restrain three suspects. Your non-lethal stun baton is ready. Approach a suspect and press G. Avoid getting surrounded.","ACCEPT ASSIGNMENT",()=>{closeDialogue();saveProgress();});
 saveProgress();
}
function spawnSecurityTargets() {
 if(hostiles.length)return;
 [[-94,-42],[-94,-49],[-94,-56]].slice(0,securityTargetsRemaining).forEach((p,i)=>{
  const g=new THREE.Group(),shirt=material([0x713f3a,0x51404a,0x6b5140][i]),skin=material(0x80543d),pants=material(0x292c32);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.29,.58,4,8),shirt);torso.position.y=1.02;g.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.21,12,10),skin);head.position.y=1.56;g.add(head);
  for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.46,3,7),pants);leg.position.set(side*.13,.4,0);g.add(leg);}
  g.position.set(p[0],0,p[1]);scene.add(g);hostiles.push({mesh:g,health:1,attack:0});
 });
}
function useStunBaton() {
 if(!securityMissionActive||!hasStunBaton){showDialogue("STUN BATON","Your stun baton is issued for the active city security contract.","CLOSE",closeDialogue);return;}
 if(batonCooldown>0)return;
 if(playerMode!=="foot"){showDialogue("STUN BATON","Exit your vehicle before using the stun baton.","CLOSE",closeDialogue);return;}
 let target=null,best=4.4;
 for(const enemy of hostiles){const d=player.position.distanceTo(enemy.mesh.position);if(d<best){best=d;target=enemy;}}
 if(!target){showDialogue("STUN BATON","No suspect is close enough. Move within range and try again.","CLOSE",closeDialogue);return;}
 batonCooldown=.65;target.health=0;scene.remove(target.mesh);
 const index=hostiles.indexOf(target);if(index>=0)hostiles.splice(index,1);
 securityTargetsRemaining=Math.max(0,securityTargetsRemaining-1);
 if(securityTargetsRemaining===0){securityMissionActive=false;securityMissionComplete=true;world.cash+=1200;cashLabel.textContent=world.cash.toLocaleString();objectiveLabel.textContent="Security contract completed · $1,200 earned";showDialogue("CITY POLICE","All three suspects have been safely restrained. The district is secure. Your $1,200 contract payment has been issued.","COLLECT PAYMENT",closeDialogue);}
 else {objectiveLabel.textContent="Security contract: "+securityTargetsRemaining+" suspects remaining · Press G";showDialogue("SECURITY CONTRACT","Suspect safely restrained. "+securityTargetsRemaining+" remaining.","CONTINUE",closeDialogue);}
 saveProgress();
}
function updateSecurity(delta) {
 if(!securityMissionActive)return;
 batonCooldown=Math.max(0,batonCooldown-delta);hostileAttackCooldown=Math.max(0,hostileAttackCooldown-delta);
 const target=playerMode==="vehicle"?vehicle.position:player.position;
 let closest=Infinity;
 for(const enemy of hostiles){
  const dx=target.x-enemy.mesh.position.x,dz=target.z-enemy.mesh.position.z,d=Math.hypot(dx,dz);closest=Math.min(closest,d);
  if(d>2.25){const step=Math.min(d-1.8,2.2*delta);enemy.mesh.position.x+=dx/d*step;enemy.mesh.position.z+=dz/d*step;enemy.mesh.rotation.y=Math.atan2(dx,dz);}
 }
 if(closest<2.3&&hostileAttackCooldown<=0){hostileAttackCooldown=1.7;damagePlayer(8);}
}
function visitHospital() {
 closeDialogue();
 if(health>=healthCapacity){showDialogue("CROWNLINE COMMUNITY CLINIC","You are already in good health. Take care out there.","CLOSE",closeDialogue);return;}
 if(world.cash<150){showDialogue("CROWNLINE COMMUNITY CLINIC","Treatment costs $150. You do not have enough cash.","CLOSE",closeDialogue);return;}
 world.cash-=150;health=healthCapacity;cashLabel.textContent=world.cash.toLocaleString();healthLabel.textContent="100%";
 showDialogue("CROWNLINE COMMUNITY CLINIC","Treatment complete. Your health is fully restored.","DONE",closeDialogue);saveProgress();
}
function damagePlayer(amount) {
 health=Math.max(0,health-amount);healthLabel.textContent=Math.round(health)+"%";
 if(health===0){
  health=healthCapacity;world.cash=Math.max(0,world.cash-100);cashLabel.textContent=world.cash.toLocaleString();
  if(homeSpawn){player.position.set(homeSpawn[0],homeSpawn[1],homeSpawn[2]);}
  else player.position.set(64,0,-40);
  if(playerMode==="vehicle"){vehicle.position.copy(player.position);speed=0;}
  else avatar.position.copy(player.position);
  healthLabel.textContent="100%";showDialogue("RECOVERY","You were taken to the community clinic. Recovery costs $100.","CONTINUE",closeDialogue);saveProgress();
 }
}
function interact() {
 if(playerMode!=="foot")return;
 if(inPoliceStation){
  if(player.position.distanceTo(new THREE.Vector3(0,-110,6))<3.5){inPoliceStation=false;player.position.set(-80,0,-40);avatar.position.copy(player.position);showDialogue("CITY POLICE","You are back outside the district police station.","CLOSE",closeDialogue);saveProgress();return;}
  if(player.position.distanceTo(new THREE.Vector3(4,-110,-5))<4){
   if(activeCityContract>=0){const c=cityContracts[activeCityContract];if(contractRecovered){world.cash+=c.reward;cashLabel.textContent=world.cash.toLocaleString();completedCityContracts.add(activeCityContract);activeCityContract=-1;contractRecovered=false;contractMarker.visible=false;objectiveLabel.textContent="District contract completed · $"+c.reward+" earned";showDialogue("CITY POLICE","Report received. Your $"+c.reward+" payment has been transferred.","COLLECT PAYMENT",closeDialogue);saveProgress();}else showDialogue("DISTRICT OPERATIONS",c.name+" is active. Travel to the gold marker, recover the assignment item, then return here. Reward: $"+c.reward+".","UNDERSTOOD",closeDialogue);return;}
   const available=cityContracts.map((c,i)=>completedCityContracts.has(i)?null:i).filter(i=>i!==null);
   if(!available.length){showDialogue("DISTRICT OPERATIONS","All available district contracts have been completed. More assignments will arrive in a future update.","CLOSE",closeDialogue);return;}
   if(!available.includes(selectedCityContract))selectedCityContract=available[0];
   const c=cityContracts[selectedCityContract];
   showDialogue("MISSION SELECTION · "+c.name,c.detail+" Reward: $"+c.reward+". Browse assignments, then accept the selected contract.","NEXT CONTRACT",()=>{const list=cityContracts.map((v,i)=>completedCityContracts.has(i)?null:i).filter(i=>i!==null);if(!list.length){closeDialogue();return;}const at=list.indexOf(selectedCityContract);selectedCityContract=list[(at+1)%list.length];const next=cityContracts[selectedCityContract];showDialogue("MISSION SELECTION · "+next.name,next.detail+" Reward: $"+next.reward+". Select ACCEPT to begin.","ACCEPT CONTRACT",()=>{activeCityContract=selectedCityContract;contractRecovered=false;contractMarker.position.set(next.x,0,next.z);contractMarker.visible=true;objectiveLabel.textContent=next.name+": travel to the marked location and return to the police station";closeDialogue();saveProgress();});});
   return;
  }
  if(player.position.distanceTo(new THREE.Vector3(-5,-110,-3))<4){showDialogue("RECEPTION","Welcome to the Central District Police Station. The operations board lists available civilian assistance contracts.","CLOSE",closeDialogue);return;}
  return;
 }
 if(player.position.distanceTo(new THREE.Vector3(-80,0,-40))<4.5){closeDialogue();inPoliceStation=true;inShop=false;inApartment=false;player.position.set(0,-110,6);avatar.position.copy(player.position);avatar.visible=true;showDialogue("CENTRAL DISTRICT POLICE","Welcome inside. Visit the operations board to choose a local assignment.","ENTER",closeDialogue);saveProgress();return;}
 if(inApartment) {
  if(player.position.distanceTo(new THREE.Vector3(0,-80,6))<3.5) {
   inApartment=false; player.position.set(16,0,-6.5); avatar.position.copy(player.position);
   showDialogue("YOUR APARTMENT","You stepped outside. Your home ownership and furnishings are saved on this device.","CLOSE",closeDialogue);
   saveProgress(); return;
  }
  if(player.position.distanceTo(new THREE.Vector3(-4,-80,-2))<3.5) {
   homeSpawn=[16,0,-6.5];
   showDialogue("YOUR BEDROOM","You rest in your own apartment. This address is now saved as your home spawn point.","SET HOME SPAWN",()=>{closeDialogue();saveProgress();});
   return;
  }
  if(player.position.distanceTo(new THREE.Vector3(4,-80,2))<3.2) {
   showDialogue("LIVING ROOM","A quiet place to relax after exploring the city. Your apartment progress is saved automatically.","CLOSE",closeDialogue);
   return;
  }
  if(player.position.distanceTo(new THREE.Vector3(0,-80,-4.7))<3.2) { showDialogue("HOME ENTERTAINMENT","Install a television and media unit for $400.","INSTALL TV · $400",()=>buyHomeUpgrade("television",400,"Living room television")); return; }
  if(player.position.distanceTo(new THREE.Vector3(7,-80,3.5))<3.2) { showDialogue("HOME DECOR","Add a potted indoor plant for $250.","ADD PLANT · $250",()=>buyHomeUpgrade("plant",250,"Indoor plant")); return; }
  if(player.position.distanceTo(new THREE.Vector3(-7,-80,1))<3.2) { showDialogue("HOME DECOR","Hang framed artwork for $300.","HANG ARTWORK · $300",()=>buyHomeUpgrade("artwork",300,"Framed artwork")); return; }
  return;
 }
 if(inShop) {
  if(player.position.distanceTo(new THREE.Vector3(0,-50,6))<3.2) {
   inShop=false; player.position.set(39.5,0,22.5); avatar.position.copy(player.position);
   showDialogue("CORNER MARKET","You stepped back out onto the street.","CLOSE",closeDialogue); saveProgress(); return;
  }
  if(player.position.distanceTo(new THREE.Vector3(0,-50,-5))<3.2){talkToLocalNpc("clerk");return;}
  if(player.position.distanceTo(new THREE.Vector3(-4,-50,-1))<3.2 || player.position.distanceTo(new THREE.Vector3(4,-50,-1))<3.2) {
   showDialogue("CORNER MARKET · SHELF","Field Kit · $250. A compact kit for your travels.","BUY FIELD KIT · $250",buyFieldKit); return;
  }
  return;
 }
 if(player.position.distanceTo(securityOfficerPosition)<6) {startSecurityMission();return;}
 if(activeCityContract>=0 && player.position.distanceTo(contractMarker.position)<5){contractRecovered=true;const c=cityContracts[activeCityContract];showDialogue("ASSIGNMENT RECOVERED",c.name+" objective secured. Return to the police station operations board to file the report and collect $"+c.reward+".","RETURN TO STATION",closeDialogue);saveProgress();return;}
 if(player.position.distanceTo(new THREE.Vector3(68,0,-42))<4.8){talkToLocalNpc("doctor");return;}
 if(player.position.distanceTo(new THREE.Vector3(-12,0,4))<4.5){talkToLocalNpc("attendant");return;}
 if(player.position.distanceTo(hospitalPosition)<7) {
  showDialogue("CROWNLINE COMMUNITY CLINIC","Medical treatment restores your health to 100%. Treatment fee: $150. Current health: "+Math.round(health)+"%.","GET TREATMENT · $150",visitHospital);return;
 }
 if(player.position.distanceTo(fuelStationPosition)<5.5) {
  showDialogue("CROWNLINE FUEL STOP","Fuel top-up: $100 for up to 25% tank capacity. Current fuel: "+Math.round(fuel)+"%.","REFUEL · $100",refuelVehicle);return;
 }
 if(player.position.distanceTo(apartmentDoorPosition)<4.8) {
  if(ownsApartment) showDialogue("YOUR APARTMENT","Welcome home. Your own starter apartment is ready whenever you need it.","ENTER HOME",enterApartment);
  else showDialogue("APARTMENT LISTING","A private starter apartment in the Central District, with a bedroom, living room and desk. Ownership is permanent in this local save.","BUY & MOVE IN · $1,500",buyApartment);
  return;
 }
 if(!missionComplete && player.position.distanceTo(missionMarker.position)<4.5) {
  if(missionStage===0)showDialogue("THE WATERFRONT CONTACT","We need a sealed supply crate taken to our dock worker. The marked hand-off point is just across the district. Can you make the delivery?","ACCEPT DELIVERY");
  else if(missionStage===1)showDialogue("DOCK WORKER","That's the crate we were waiting for. The waterfront crew can take it from here. Thank you for getting it here safely.","COMPLETE DELIVERY · $1,000");
  return;
 }
 if(player.position.distanceTo(shopPosition)<4.8)showDialogue("CORNER MARKET","Welcome. Come inside and browse the shelves.","ENTER MARKET",()=>{ closeDialogue(); inShop=true; player.position.set(0,-50,6); avatar.position.copy(player.position); avatar.visible=true; player.heading=Math.PI; avatar.rotation.y=player.heading; saveProgress(); });
}
function makeShopInterior() {
 const room=new THREE.Group(); room.position.y=-50;
 box(room,0,-.18,0,16,.35,16,material(0x6e6b60),false);
 const wall=material(0xb6a78e);
 box(room,0,2.5,-8,16,5,.35,wall); box(room,-8,2.5,0,.35,5,16,wall); box(room,8,2.5,0,.35,5,16,wall); box(room,0,2.5,8,16,5,.35,wall);
 box(room,0,4.95,0,16,.25,16,material(0x42494a),false);
 for(const x of [-4,4]) {
  box(room,x,1.35,-1,1.1,2.7,5.2,material(0x72563c));
  for(let level=0;level<3;level++) box(room,x, .55+level*.82,-1,1.25,.12,5.35,material(0xc3a16a),false);
  for(let n=0;n<4;n++) box(room,x+(n%2?-.25:.25),.85+Math.floor(n/2)*.82,-2.7+n*.95,.28,.38,.28,material([0x9c7042,0x557b75,0xb9a56e,0x8b554b][n]),false);
 }
 box(room,0,.65,5.6,5,.9,1.1,material(0x634a35));
 const labelCanvas=document.createElement("canvas");labelCanvas.width=512;labelCanvas.height=128;const c=labelCanvas.getContext("2d");c.fillStyle="#17252a";c.fillRect(0,0,512,128);c.fillStyle="#e1bd78";c.font="bold 58px sans-serif";c.textAlign="center";c.fillText("WELCOME",256,82);
 const label=new THREE.Mesh(new THREE.PlaneGeometry(5,1.25),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(labelCanvas)}));label.position.set(0,3.1,-7.78);room.add(label); scene.add(room);
}

function makeApartmentInterior() {
 const room=new THREE.Group(); room.position.y=-80;
 box(room,0,-.18,0,18,.35,16,material(0x6d6255),false);
 const wall=material(0xd0c2a7);
 box(room,0,2.5,-8,18,5,.35,wall); box(room,-9,2.5,0,.35,5,16,wall); box(room,9,2.5,0,.35,5,16,wall); box(room,0,2.5,8,18,5,.35,wall);
 box(room,0,4.95,0,18,.25,16,material(0x30383b),false);
 box(room,-4,.38,-2,4.2,.55,3.5,material(0x553d31));
 box(room,-4,.78,-2,3.9,.28,3.25,material(0xd8d0bd));
 box(room,-4,1.02,-3.15,3.8,.22,.55,material(0x9caaad));
 box(room,-5.1,1.1,-3.15,.75,.2,.42,material(0xf0e8d8));
 box(room,-2.1,.7,-3.1,1,.9,1,material(0x6b513d));
 box(room,4,.65,2,4.2,1.1,1.5,material(0x53636a));
 box(room,4,1.18,1.35,4.2,.25,.3,material(0x38484f));
 box(room,4,.38,-.2,2.2,.35,1.2,material(0x765a3e));
 box(room,4,.75,-4,3.4,.18,1.2,material(0x76583d));
 box(room,4,1.35,-4.35,1.5,1.05,.12,material(0x1e2b31));
 box(room,4,1.36,-4.25,1.25,.78,.04,material(0x527a82));
 box(room,7,1.35,-5.7,1.5,2.7,1.1,material(0x775d45));
 const tv=new THREE.Group();
 box(tv,0,1.85,0,2.8,1.65,.16,material(0x11191d)); box(tv,0,1.85,.1,2.52,1.38,.035,material(0x426b75,.3)); box(tv,0,.35,.35,3.4,.7,.8,material(0x493a30));
 tv.position.set(0,0,-7.35);tv.visible=false;room.add(tv);homeUpgradeMeshes.television=tv;
 const plant=new THREE.Group();
 const pot=new THREE.Mesh(new THREE.CylinderGeometry(.38,.28,.55,12),material(0x9a6749));pot.position.y=.28;plant.add(pot);
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1.2,7),material(0x42613e));stem.position.y=1.05;plant.add(stem);
 for(let i=0;i<5;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.35,8,7),material(0x47734c));leaf.scale.set(.55,1.5,.45);leaf.position.set(Math.cos(i*1.25)*.42,1.15+Math.sin(i*1.25)*.3,Math.sin(i*1.25)*.42);plant.add(leaf);}
 plant.position.set(7,0,3.5);plant.visible=false;room.add(plant);homeUpgradeMeshes.plant=plant;
 const art=new THREE.Group();
 box(art,0,0,0,1.8,1.35,.12,material(0x72563c));box(art,0,0,.08,1.55,1.1,.035,material(0x426b75));
 const sunDisc=new THREE.Mesh(new THREE.CircleGeometry(.28,20),new THREE.MeshBasicMaterial({color:0xe4bd75}));sunDisc.position.set(.38,.25,.11);art.add(sunDisc);
 art.position.set(-7.45,2.2,1);art.visible=false;room.add(art);homeUpgradeMeshes.artwork=art;
 const signCanvas=document.createElement("canvas");signCanvas.width=512;signCanvas.height=128;
 const c=signCanvas.getContext("2d");c.fillStyle="#17252a";c.fillRect(0,0,512,128);c.fillStyle="#e1bd78";c.font="bold 48px sans-serif";c.textAlign="center";c.fillText("YOUR HOME",256,82);
 const label=new THREE.Mesh(new THREE.PlaneGeometry(4.8,1.2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(signCanvas)}));label.position.set(0,3.35,-7.78);room.add(label);
 scene.add(room);
}
function makeApartmentExterior() {
 const home=new THREE.Group();home.position.set(16,0,-16);
 box(home,0,4.2,0,14,8.4,12,material(0x9b8c78));
 box(home,0,8.55,0,14.5,.3,12.5,material(0x343e42),false);
 box(home,0,1.65,6.08,2.5,3.3,.16,material(0x4a3025),false);
 box(home,-4.2,3.4,6.08,2.1,1.8,.12,material(0x263d47),false);
 box(home,4.2,3.4,6.08,2.1,1.8,.12,material(0x263d47),false);
 box(home,-4.2,6.3,6.08,2.1,1.5,.12,material(0x263d47),false);
 box(home,4.2,6.3,6.08,2.1,1.5,.12,material(0x263d47),false);
 box(home,0,2.2,6.2,3.5,.18,1.1,material(0x725a42));
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext("2d");ctx.fillStyle="#17252a";ctx.fillRect(0,0,512,128);ctx.fillStyle="#e1bd78";ctx.font="900 52px sans-serif";ctx.textAlign="center";ctx.fillText("RESIDENCES",256,82);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.8,1.45),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));sign.position.set(0,7.1,6.16);home.add(sign);
 scene.add(home);
 buildingBounds.push({minX:7,maxX:25,minZ:-24,maxZ:-8});
 makeApartmentInterior();
}
function makeShopAndLandmarks() {
 const shop = new THREE.Group(); shop.position.set(48,0,16);
 box(shop,0,3,0,12,6,10,material(0xb69a72));
 box(shop,0,6.12,0,12.3,.24,10.3,material(0x42494a),false);
 box(shop,0,1.65,5.06,7.4,3.3,.18,material(0x253c43,.35),false);
 box(shop,-4.35,1.5,5.08,1.1,3,.2,material(0x8a6947),false);
 box(shop,4.35,1.5,5.08,1.1,3,.2,material(0x8a6947),false);
 const signCanvas=document.createElement("canvas");signCanvas.width=512;signCanvas.height=128;
 const ctx=signCanvas.getContext("2d");ctx.fillStyle="#17252a";ctx.fillRect(0,0,512,128);ctx.fillStyle="#e1bd78";ctx.font="900 58px sans-serif";ctx.textAlign="center";ctx.fillText("CORNER MARKET",256,82);
 const signTexture=new THREE.CanvasTexture(signCanvas);const sign=new THREE.Mesh(new THREE.PlaneGeometry(8.5,2.1),new THREE.MeshBasicMaterial({map:signTexture}));sign.position.set(0,4.15,5.18);shop.add(sign);scene.add(shop);
 buildingBounds.push({minX:40.4,maxX:55.6,minZ:8.8,maxZ:23.2});
 // A civic clock tower gives the district a distant navigation landmark.
 const tower=new THREE.Group();tower.position.set(-48,0,48);
 box(tower,0,11,0,9,22,9,material(0x9caaab));
 box(tower,0,22.4,0,10,1,10,material(0x4a5659));
 const crown=new THREE.Mesh(new THREE.ConeGeometry(6.2,8,4),material(0x5a6260));crown.position.y=27;crown.rotation.y=Math.PI/4;tower.add(crown);
 const clockFace=new THREE.Mesh(new THREE.CircleGeometry(1.45,32),new THREE.MeshBasicMaterial({color:0xe6d2a4}));clockFace.position.set(0,17.2,4.56);tower.add(clockFace);
 const hand=new THREE.Mesh(new THREE.BoxGeometry(.08,1.05,.04),material(0x27343a));hand.position.set(0,17.45,4.62);tower.add(hand);scene.add(tower);
 buildingBounds.push({minX:-54,maxX:-42,minZ:42,maxZ:54});
 makeStaticNpc(40,16,0x9b884e);
 makeShopInterior();
 makeApartmentExterior();
}

function makeHospital() {
 const clinic=new THREE.Group();clinic.position.set(64,0,-48);
 box(clinic,0,4.2,0,14,8.4,10,material(0xd8d8cc));
 box(clinic,0,8.55,0,14.5,.3,10.5,material(0x3b555c),false);
 box(clinic,0,1.55,5.08,2.8,3.1,.16,material(0x496b76),false);
 box(clinic,-4,3.5,5.08,2.1,1.6,.12,material(0x426b75),false);
 const c=document.createElement("canvas");c.width=512;c.height=128;const ctx=c.getContext("2d");ctx.fillStyle="#f1eee5";ctx.fillRect(0,0,512,128);ctx.fillStyle="#a33c39";ctx.font="900 62px sans-serif";ctx.textAlign="center";ctx.fillText("COMMUNITY CLINIC",256,82);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(7.5,1.85),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));sign.position.set(0,6.6,5.12);clinic.add(sign);
 box(clinic,0,4.6,5.18,1.1,1.1,.1,material(0xb84b45),false);box(clinic,0,4.6,5.25,.28,1.55,.12,material(0xf3eee4),false);box(clinic,0,4.6,5.26,1.55,.28,.12,material(0xf3eee4),false);
 scene.add(clinic);buildingBounds.push({minX:56.5,maxX:71.5,minZ:-53.5,maxZ:-42.5});
 makeStaticNpc(64,-39,0x5e8b84);
}
function makePoliceStation() {
 const station=new THREE.Group();station.position.set(-80,0,-48);
 box(station,0,3.6,0,15,7.2,10,material(0x9ca9aa));box(station,0,7.35,0,15.5,.3,10.5,material(0x344b59),false);
 box(station,0,1.5,5.08,2.7,3,.16,material(0x344b59),false);
 const c=document.createElement("canvas");c.width=512;c.height=128;const ctx=c.getContext("2d");ctx.fillStyle="#203747";ctx.fillRect(0,0,512,128);ctx.fillStyle="#e8d7a8";ctx.font="900 62px sans-serif";ctx.textAlign="center";ctx.fillText("POLICE",256,82);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(6.5,1.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));sign.position.set(0,5.6,5.12);station.add(sign);
 scene.add(station);buildingBounds.push({minX:-88.2,maxX:-71.8,minZ:-54,maxZ:-42});
 makeStaticNpc(-80,-35,0x344b75);
}
function makePoliceInterior() {
 const room=new THREE.Group();room.position.y=-110;
 box(room,0,-.18,0,18,.35,16,material(0x59636a),false);
 const wall=material(0xb7c1c2);
 box(room,0,2.5,-8,18,5,.35,wall);box(room,-9,2.5,0,.35,5,16,wall);box(room,9,2.5,0,.35,5,16,wall);box(room,0,2.5,8,18,5,.35,wall);
 box(room,0,4.95,0,18,.25,16,material(0x263746),false);
 box(room,-5,.65,-3,5,1.3,1.4,material(0x394b55));box(room,-5,1.4,-3,5.1,.12,1.5,material(0x9ba7a5));
 box(room,4,1.25,-5,6,2.5,.5,material(0x344b59));box(room,4,2.7,-4.7,4.8,.6,.15,material(0xd8b36a));box(room,0,.65,3,5,1.3,1.2,material(0x4a5155));
 const c=document.createElement("canvas");c.width=512;c.height=128;const ctx=c.getContext("2d");ctx.fillStyle="#203747";ctx.fillRect(0,0,512,128);ctx.fillStyle="#e8d7a8";ctx.font="900 54px sans-serif";ctx.textAlign="center";ctx.fillText("DISTRICT OPERATIONS",256,82);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(7,1.75),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));sign.position.set(0,3.5,-7.78);room.add(sign);scene.add(room);
}
function makePoliceCar() {
 const car=new THREE.Group();
 box(car,0,.72,0,1.9,.62,3.8,material(0xe8e9e5,.4));
 box(car,0,1.34,-.18,1.52,.72,1.8,material(0x263a43,.28));
 box(car,0,1.05,1.12,1.94,.16,.08,material(0x1d2b32));
 for(const x of [-.98,.98])for(const z of [-1.2,1.2]){
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,12),material(0x171a1b));tire.rotation.z=Math.PI/2;tire.position.set(x,.42,z);car.add(tire);
 }
 const red=new THREE.Mesh(new THREE.BoxGeometry(.42,.14,.22),new THREE.MeshStandardMaterial({color:0xff2638,emissive:0x8c0712}));
 const blue=new THREE.Mesh(new THREE.BoxGeometry(.42,.14,.22),new THREE.MeshStandardMaterial({color:0x287dff,emissive:0x092c8c}));
 red.position.set(-.25,1.78,-.18);blue.position.set(.25,1.78,-.18);car.add(red,blue);
 patrolLights.push(red,blue);
 car.position.set(-78,0,-78);scene.add(car);return car;
}
function updatePolice(delta) {
 if(!patrolCar)return;
 patrolSirenTime+=delta;
 const active=wantedLevel>0;
 patrolLights.forEach((light,index)=>{light.visible=active&&Math.floor(patrolSirenTime*7)%2===index;});
 if(!active){patrolCar.position.lerp(new THREE.Vector3(-78,0,-78),Math.min(1,delta*.8));return;}
 const target=playerMode==="vehicle"?vehicle.position:player.position;
 const dx=target.x-patrolCar.position.x,dz=target.z-patrolCar.position.z;
 const distance=Math.hypot(dx,dz);
 const heading=Math.atan2(dx,dz);
 patrolCar.rotation.y=heading;
 const pace=10+wantedLevel*3;
 if(distance>2.8){patrolCar.position.x+=Math.sin(heading)*pace*delta;patrolCar.position.z+=Math.cos(heading)*pace*delta;}
 if(distance<3.5){
  world.cash=Math.max(0,world.cash-250);cashLabel.textContent=world.cash.toLocaleString();
  wantedLevel=0;wantedTimer=0;updateWantedDisplay();
  showDialogue("CITY POLICE","Officers caught up with you. A $250 traffic fine has been issued. Drive safely.","UNDERSTOOD",closeDialogue);
  saveProgress();
 }
}
function updateWantedDisplay() {
 const label=document.querySelector("#wanted");
 if(label)label.textContent=wantedLevel?"★".repeat(wantedLevel)+"☆".repeat(3-wantedLevel):"CLEAR";
}
function makeFuelStation() {
 const station=new THREE.Group();station.position.set(-18,0,0);
 box(station,0,.18,0,15,.36,12,material(0x777b72),false);
 box(station,0,5.1,-1,13,.35,8,material(0xe1d8c4),false);
 for(const x of [-5.3,5.3])box(station,x,2.55,-1,.35,5.1,.35,material(0x59636a));
 box(station,0,5.45,-1,13.2,.25,8.2,material(0x253b46),false);
 const signCanvas=document.createElement("canvas");signCanvas.width=512;signCanvas.height=128;
 const ctx=signCanvas.getContext("2d");ctx.fillStyle="#17252a";ctx.fillRect(0,0,512,128);ctx.fillStyle="#e5bd69";ctx.font="900 62px sans-serif";ctx.textAlign="center";ctx.fillText("CROWNLINE FUEL",256,84);
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(8,2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(signCanvas)}));sign.position.set(0,5.7,3.12);station.add(sign);
 for(const x of [-3,0,3]){
  box(station,x,.95,1.8,1.15,1.9,.85,material(0xd8d9d2));
  box(station,x,1.45,1.8,.82,.48,.9,material(0x263b46));
  box(station,x,2.1,1.8,.14,.8,.14,material(0x252b2e));
  const hose=new THREE.Mesh(new THREE.TorusGeometry(.32,.055,6,16,Math.PI),material(0x202629));hose.rotation.z=Math.PI/2;hose.position.set(x+.48,1.15,2.05);station.add(hose);
 }
 scene.add(station);
 makeStaticNpc(-25,2,0x315b58);
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
  makeShopAndLandmarks();
  makeFuelStation();
  makeHospital();
  makePoliceStation();
  makePoliceInterior();
  makeStaticNpc(0,-50,-5,0x9b884e);
  makeStaticNpc(68,-42,0x496b76);
  makeStaticNpc(-12,4,0xd0a45c);
  patrolCar=makePoliceCar();
  vehicle = makeCar();
  populateLife();
  player = { position: vehicle.position.clone(), heading: 0 };
  avatar = makeAvatar(); missionMarker = makeMissionMarker();
  contractMarker=makeMissionMarker();contractMarker.visible=false;
  makeStaticNpc(20,40,0x9b5b36); makeStaticNpc(-27,-42,0x315b58);
  clock = new THREE.Clock();
}

function update(delta) {
 if(!running||paused)return;
 updateAmbientLife(delta);
 updatePolice(delta);
 updateSecurity(delta);
 if(wantedLevel>0){wantedTimer-=delta;if(wantedTimer<=0){wantedLevel=0;updateWantedDisplay();}}
 if(playerMode==="vehicle"){
  const f=keys.has("KeyW")||keys.has("ArrowUp"),r=keys.has("KeyS")||keys.has("ArrowDown");
  const l=keys.has("KeyA")||keys.has("ArrowLeft"),q=keys.has("KeyD")||keys.has("ArrowRight");
  speed=THREE.MathUtils.damp(speed,keys.has("Space")?0:f&&fuel>0?26:r&&fuel>0?-12:0,2.8,delta);
  if(Math.abs(speed)>.1){fuel=Math.max(0,fuel-(Math.abs(speed)/26)*.035*delta);fuelLabel.textContent=Math.round(fuel)+"%";}
  if(fuel<=0)speed=THREE.MathUtils.damp(speed,0,5,delta);
  const steer=(q?1:0)-(l?1:0);
  if(Math.abs(speed)>.25)vehicle.rotation.y-=steer*delta*1.7*Math.sign(speed)*Math.min(1,Math.abs(speed)/8);
  const dir=new THREE.Vector3(Math.sin(vehicle.rotation.y),0,Math.cos(vehicle.rotation.y)),prev=vehicle.position.clone();
  vehicle.position.addScaledVector(dir,speed*delta); vehicle.position.x=clamp(vehicle.position.x,-112,112); vehicle.position.z=clamp(vehicle.position.z,-105,112);
  if(collidesWithBuilding(vehicle.position)){vehicle.position.copy(prev);speed=0;}
  for(const car of traffic)if(vehicle.position.distanceTo(car.mesh.position)<2.2){vehicle.position.copy(prev);speed=0;break;}
  for(const person of pedestrians)if(vehicle.position.distanceTo(person.mesh.position)<1.9&&Math.abs(speed)>7&&!person.reported){person.reported=true;wantedLevel=Math.min(3,wantedLevel+1);wantedTimer=55;updateWantedDisplay();showDialogue("CITY POLICE","A patrol has been alerted after a dangerous collision. Leave the area or wait for the pursuit to end.","DRIVE",closeDialogue);saveProgress();break;}
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
  if(inApartment ? (Math.abs(player.position.x)>8.1 || Math.abs(player.position.z)>6.8) : inShop ? (Math.abs(player.position.x)>6.8 || Math.abs(player.position.z)>6.8) : inPoliceStation ? (Math.abs(player.position.x)>8.1 || Math.abs(player.position.z)>6.8) : collidesWithBuilding(player.position))player.position.copy(prev);
  for(const car of traffic)if(player.position.distanceTo(car.mesh.position)<1.45){player.position.copy(prev);damagePlayer(12);break;}
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
function drawMinimap() {
  if (!minimapContext || !running || paused) return;
  const ctx = minimapContext, w = minimapCanvas.width, h = minimapCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(7,13,18,.88)"; ctx.fillRect(0, 0, w, h);
  const center = playerMode === "vehicle" ? vehicle.position : player.position;
  const range = 115, scale = w / (range * 2);
  const px = (x) => w / 2 + (x - center.x) * scale;
  const py = (z) => h / 2 + (z - center.z) * scale;
  ctx.strokeStyle = "rgba(215,205,175,.32)"; ctx.lineWidth = 4;
  for (let n = -3; n <= 3; n++) {
    const x = px(n * 32), y = py(n * 32);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  const dot = (x,z,color,radius=3) => {
    const dx=px(x),dy=py(z); if(dx < -5 || dx > w+5 || dy < -5 || dy > h+5)return;
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(dx,dy,radius,0,Math.PI*2);ctx.fill();
  };
  dot(48,16,"#e3bd78",4); // Corner Market
  dot(-48,48,"#85c6d0",4); // Civic tower
  dot(16,-16,"#d8b36a",4); // Apartment
  dot(-18,0,"#e28b55",4); // CROWNLINE Fuel
  dot(-78,-78,"#7da7e8",4); // Police patrol base
  dot(64,-48,"#e28b8b",4); // Community clinic
  dot(-80,-48,"#7da7e8",4); // Police station
  if (missionMarker?.visible) dot(missionMarker.position.x, missionMarker.position.z, "#f0d078",4);
  if(contractMarker?.visible) dot(contractMarker.position.x,contractMarker.position.z,"#7ed7b1",4);
  dot(center.x,center.z,"#ffffff",4);
  ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=1;ctx.strokeRect(.5,.5,w-1,h-1);
  ctx.fillStyle="#d8b36a";ctx.font="bold 9px sans-serif";ctx.fillText("N",w-13,12);
}
function frame() {
  requestAnimationFrame(frame);
  const delta = Math.min(clock ? clock.getDelta() : .016, .05);
  update(delta);
  drawMinimap();
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
  if (!event.repeat && event.code === "KeyI" && running && !paused && dialoguePanel.classList.contains("hidden")) openInventory();
  if (!event.repeat && event.code === "KeyG" && running && !paused && dialoguePanel.classList.contains("hidden")) useStunBaton();
  if (!event.repeat && event.code === "KeyF" && running && !paused) { if(playerMode==="vehicle") exitVehicle(); else enterVehicle(); }
  if (!event.repeat && event.code === "KeyE" && running && !paused && dialoguePanel.classList.contains("hidden")) interact();
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
dialogueAction.addEventListener("click", () => { if(dialogueActionHandler)dialogueActionHandler(); });
try {
  buildWorld();
  try {
    const saved = JSON.parse(localStorage.getItem("crownline-save") || "null");
    if(saved){
      world.cash=Number(saved.cash)||2500;fuel=Number.isFinite(saved.fuel)?clamp(saved.fuel,0,fuelCapacity):fuel;fuelLabel.textContent=Math.round(fuel)+"%";health=Number.isFinite(saved.health)?clamp(saved.health,0,healthCapacity):health;healthLabel.textContent=Math.round(health)+"%";securityMissionActive=Boolean(saved.securityMissionActive);securityMissionComplete=Boolean(saved.securityMissionComplete);hasStunBaton=Boolean(saved.hasStunBaton);securityTargetsRemaining=Number.isFinite(saved.securityTargetsRemaining)?clamp(saved.securityTargetsRemaining,0,3):0;if(avatar?.userData.stunBaton)avatar.userData.stunBaton.visible=hasStunBaton;if(securityMissionActive)spawnSecurityTargets();wantedLevel=0;updateWantedDisplay();world.supplies=Number.isFinite(saved.supplies)?Math.max(0,saved.supplies):0;world.visited=Boolean(saved.visited);missionComplete=Boolean(saved.missionComplete);missionStage=Number.isInteger(saved.missionStage)?clamp(saved.missionStage,0,2):(missionComplete?2:0);
      if(Array.isArray(saved.vehiclePosition))vehicle.position.fromArray(saved.vehiclePosition);
      if(Number.isFinite(saved.vehicleHeading))vehicle.rotation.y=saved.vehicleHeading;
      if(Array.isArray(saved.playerPosition))player.position.fromArray(saved.playerPosition);
      if(Number.isFinite(saved.playerHeading))player.heading=saved.playerHeading;
      if(saved.playerMode==="foot"){playerMode="foot";avatar.visible=true;avatar.position.copy(player.position);avatar.rotation.y=player.heading;}
      ownsApartment=Boolean(saved.ownsApartment);
      homeSpawn=Array.isArray(saved.homeSpawn)?saved.homeSpawn:null;
      homeUpgrades={television:Boolean(saved.homeUpgrades?.television),plant:Boolean(saved.homeUpgrades?.plant),artwork:Boolean(saved.homeUpgrades?.artwork)};
      for(const name of Object.keys(homeUpgrades)) if(homeUpgradeMeshes[name]) homeUpgradeMeshes[name].visible=homeUpgrades[name];
      if(saved.inApartment && playerMode==="foot"){inApartment=true;inShop=false;inPoliceStation=false;player.position.set(0,-80,6);avatar.position.copy(player.position);}
      else if(saved.inShop && playerMode==="foot"){inShop=true;inPoliceStation=false;player.position.set(0,-50,6);avatar.position.copy(player.position);}
      else if(saved.inPoliceStation && playerMode==="foot"){inPoliceStation=true;player.position.set(0,-110,6);avatar.position.copy(player.position);}
      else if(homeSpawn && playerMode==="foot"){player.position.fromArray(homeSpawn);avatar.position.copy(player.position);avatar.rotation.y=player.heading;}
      if(saved.npcDialogueIndex&&typeof saved.npcDialogueIndex==="object")for(const id of Object.keys(npcDialogueIndex)){const value=saved.npcDialogueIndex[id];if(Number.isInteger(value))npcDialogueIndex[id]=Math.max(0,Math.min(npcDialogue[id].lines.length-1,value));}
      contractRecovered=Boolean(saved.contractRecovered);
      if(Array.isArray(saved.completedCityContracts))saved.completedCityContracts.forEach(i=>{if(Number.isInteger(i)&&i>=0&&i<cityContracts.length)completedCityContracts.add(i);});
      activeCityContract=Number.isInteger(saved.activeCityContract)&&saved.activeCityContract>=0&&saved.activeCityContract<cityContracts.length?saved.activeCityContract:-1;
      if(activeCityContract>=0){const c=cityContracts[activeCityContract];contractMarker.position.set(c.x,0,c.z);contractMarker.visible=true;objectiveLabel.textContent=c.name+": recover the assignment item and return to the police station";}
      if(missionStage===1)missionMarker.position.set(-25,0,-42);
      if(missionComplete||missionStage===2)missionMarker.visible=false;
      cashLabel.textContent=world.cash.toLocaleString();
      if(securityMissionComplete)objectiveLabel.textContent="Security contract completed · $1,200 earned";
      else if(securityMissionActive)objectiveLabel.textContent="Security contract: "+securityTargetsRemaining+" suspects remaining · Press G";
      else if(missionStage===2)objectiveLabel.textContent="Delivery completed · $1,000 earned";
      else if(missionStage===1)objectiveLabel.textContent="Deliver the supplies to the dock worker";
      else if(world.visited)objectiveLabel.textContent="Meet the waterfront contact";
    }
  } catch {}
  loading.classList.add("hidden");
  frame();
} catch (error) {
  console.error("CROWNLINE startup error:", error);
  loading.classList.add("hidden");
  errorMessage.classList.remove("hidden");
}
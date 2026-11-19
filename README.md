# CROWNLINE — The New Vision

**A continental open-world universe by JagX and JRILICENSE.**

CROWNLINE is being restarted in this repository as a browser-first 3D game prototype, with PC as the primary target. The long-term vision is a large, explorable world spanning selected African countries, regions and cities. Locations will draw on real geography and local atmosphere while using fictionalized characters, businesses, stories and buildings where appropriate.

## Current milestone — 1.1 police patrols and wanted system

- Browser-based 3D scene powered by Three.js.
- Procedurally assembled coastal city district with roads, buildings, trees, shore and water.
- Third-person follow camera and a drivable starter vehicle.
- Moving ambient traffic and pedestrians bring the starter district to life.
- Building and vehicle collision checks stop the player car passing through solid objects.
- On-foot third-person character with basic walk/run limb animation.
- Press **F** to exit or re-enter the starter vehicle (re-entry requires being nearby; exit requires the vehicle to be nearly stopped).
- First two-step story mission: meet the waterfront contact, accept a supply delivery, then hand it to the dock worker.
- Context dialogue panel with mission acceptance and completion actions.
- Completing the delivery awards $1,000; mission stage and cash persist in the local save.
- Added the named Corner Market storefront with a nearby shopkeeper and an on-foot interaction.
- Players can purchase a Field Kit for $250; cash and owned kit count persist locally.
- Added a distinctive civic clock tower as a visible district landmark with collision boundaries.
- Added a live district minimap showing the player, Corner Market, civic tower and active mission marker.
- Corner Market is enterable: explore its interior, browse stocked shelves, buy Field Kits, and leave through the entrance. Interior position is preserved in local saves.
- Added an ownable Central District apartment for $1,500, with a furnished bedroom, living room, work desk and wardrobe.
- Apartment ownership and interior location persist in the local save; resting at the bed saves the home spawn point, which is now used when the player reloads the game on foot.
- Added purchasable home furnishings: a living-room television/media unit ($400), indoor plant ($250) and framed artwork ($300). Purchased items appear in the apartment and persist in the local save.
- Added a roadside CROWNLINE Fuel station with a canopy, branded sign, three fuel pumps and an attendant.
- Vehicle fuel starts at 100%, drains gradually while driving, and is saved locally. At the station, exit the vehicle and press E nearby to buy a $100 top-up of up to 25% fuel. Driving is disabled when the tank is empty.
- Added a marked police cruiser with flashing red-and-blue emergency lights and an active pursuit behaviour.
- Dangerous high-speed collisions with pedestrians alert the police and raise the wanted level, up to three stars. Patrol officers pursue the player, and wanted status clears after the pursuit timer expires.
- If officers catch the player, a $250 fine is deducted and the pursuit ends. The HUD displays the current wanted status.
- Fixed an initialization-order issue in the shop inventory state that could prevent the game module from starting.
- Basic progress saving for cash, mission completion, player position and vehicle position.
- Keyboard driving controls, speed display, objective HUD and pause/resume.
- Responsive title screen and local browser save for basic progress.
- GitHub Pages workflow for static hosting.

This is an early playable foundation, not a finished open world. The first district is a small procedural test area; streaming geography, detailed interiors, deeper mission systems, multiplayer and production-grade assets are later milestones.

## Run locally

Serve this folder with any static web server, then open the local URL in a modern browser. The Three.js module is loaded from jsDelivr, so the first launch requires an internet connection.

## Controls

- **W / A / S / D** or arrow keys — drive and steer
- **F** — enter or exit vehicle
- **E** — talk to mission characters, enter the market or apartment, refuel at the station, shop, and use home furniture while on foot
- **Shift** — sprint while on foot
- **Space** — brake while driving
- **Esc** — pause or resume

## Project structure

- `index.html` — game shell and HUD
- `styles.css` — interface and responsive layout
- `src/game.js` — Three.js world and prototype gameplay
- `.github/workflows/pages.yml` — validates JavaScript and publishes only the static game files to GitHub Pages

## Roadmap

1. Validate the 3D foundation and improve driving, collision and camera behaviour.
2. Expand the first city district with more storefronts, interiors, landmarks and mission interactions.
3. Add streamed world regions and a data-driven continent/city map.
4. Add character systems, interiors, economy, progression, audio and save profiles.
5. Evaluate multiplayer and expanded PC distribution after the core single-player experience is stable.

**Principle:** build a strong, testable world system first; expand the continent district by district rather than claiming a huge map before it exists.
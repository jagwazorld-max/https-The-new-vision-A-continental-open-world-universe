# CROWNLINE — The New Vision

**A continental open-world universe by JagX and JRILICENSE.**

CROWNLINE is being restarted in this repository as a browser-first 3D game prototype, with PC as the primary target. The long-term vision is a large, explorable world spanning selected African countries, regions and cities. Locations will draw on real geography and local atmosphere while using fictionalized characters, businesses, stories and buildings where appropriate.

## Current milestone — 2.4 urban street infrastructure

- Browser-based 3D scene powered by Three.js.\n- A continuous 12-minute day/night cycle changes the sky, fog, sunlight, ambient light and exposure; the in-game clock is shown in the top bar. The world clock is saved with player progress.\n- Street lamps illuminate the main road grid at night, building windows glow after dark, and the player's car headlights brighten the road ahead. Night lighting fades smoothly with the day cycle.
- Added raised curbs and paved sidewalks along the road grid, zebra crossings at key junctions, and a four-way traffic-signal installation at the central civic intersection. Signals are currently visual city infrastructure; traffic-light AI is a later upgrade.
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
- Added a player health meter. On-foot collisions with traffic cause damage; reaching zero triggers recovery at the clinic and a $100 recovery charge.
- Press **I** to inspect the inventory, including health, fuel and Field Kit count. Use a Field Kit from the inventory to restore up to 40 health.
- Added a Community Clinic landmark. On foot, press **E** near the entrance to purchase full treatment for $150.
- Health and inventory supplies are saved locally, and older saves load with default full health.
- Added an enterable Central District Police Station with a reception lobby, operations board, briefing counter and evidence-room fixtures. The station interior and return-to-street transition are saved locally.
- Added a mission-selection board with two optional civilian contracts: recover lost evidence ($650) or deliver community supplies ($850). Players can browse assignments, accept one, travel to its marker, then return to the station to file the report and collect payment. Active and completed contracts persist locally.
- Rebuilt the player, pedestrians and named local NPCs with more human proportions, shaped torsos, necks, ears, facial features, varied hairstyles, clothing details, footwear and accessories.
- Improved character gait with alternating arm/leg stride, knee/hip motion, torso bounce, head movement and more coherent pedestrian facing direction.
- Added mobile touch controls: proportional analog movement joystick with variable walking speed, vehicle throttle/reverse and steering, two-axis swipe camera orbit (horizontal orbit independent of character/vehicle steering plus vertical camera pitch), variable joystick walking gait animation, interact, enter/exit vehicle, sprint, inventory, brake and stun actions. Keyboard controls remain supported on PC.
- Added mobile rendering settings with reduced pixel ratio, disabled antialiasing and smaller shadow maps on touch-sized devices to improve performance.
- Added individual articulated arm and leg pivots with continuous walk cycles for ambient pedestrians and the player; NPCs now have varied skin tones, outfits and silhouettes.
- Added three local NPCs with individual conversation topics: a Corner Market clerk, Community Clinic doctor and CROWNLINE Fuel attendant. Each has multiple dialogue lines, a repeatable conversation flow and locally saved conversation progress.
- Added dedicated NPC interaction zones inside the market and beside the clinic and fuel station, separate from shopping and treatment interactions.
- Removed a duplicate contract-marker draw in the minimap.
- Added a separate contract marker to the minimap so the active assignment remains distinct from the waterfront story mission.
- Added a police station landmark and a City Police officer who offers a security contract.
- Accepting the contract equips a visible non-lethal stun baton and spawns three suspects at the service yard.
- Press **G** while on foot and within range to safely restrain a suspect. Suspects pursue the player and can cause health damage at close range.
- Restraining all three suspects completes the contract and awards $1,200. Contract progress, baton ownership and remaining targets are saved; partial contracts resume with the correct remaining target count.
- Fixed an initialization-order issue in the shop inventory state that could prevent the game module from starting.
- Basic progress saving for cash, mission completion, player position and vehicle position.
- Keyboard driving controls, speed display, objective HUD and pause/resume.
- Responsive title screen and local browser save for basic progress.
- GitHub Pages workflow for static hosting.

This is an early playable foundation, not a finished open world. The first district is a small procedural test area; streaming geography, detailed interiors, deeper mission systems, multiplayer and production-grade assets are later milestones.

## Run locally

Serve this folder with any static web server, then open the local URL in a modern browser. The Three.js module is loaded from jsDelivr, so the first launch requires an internet connection.

## Controls

- **W / A / S / D** or arrow keys — move and steer (mobile: virtual joystick)
- **F** — enter or exit vehicle
- **I** — open inventory and use a Field Kit.
- **G** — use the non-lethal stun baton during an active security contract.
- **E** — talk to local NPCs and mission characters, enter the market, apartment or police station, use the operations board, refuel, shop and use home furniture while on foot
- **Shift** — sprint while on foot
- **Space** — brake while driving
- **Esc** — pause or resume
- **Mobile** — drag the virtual joystick to move/drive, swipe the right side of the screen to look around, and tap the action buttons to interact, enter/exit the car, sprint, brake, open inventory or use the stun baton.

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
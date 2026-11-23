# Dwarfhold

Dwarfhold is a small browser-based colony and resource-management game. You are the warden of **Stonehome**, a new settlement beneath Emberpeak. Your three dwarves gather supplies, eat from the shared food stores, forge equipment, and explore locations beyond the hold.

This is a partially completed starter for the Advanced Web Development practical exam. It is already playable, but it is not yet a finished game. Investigate its existing behavior and extend it according to the [Requirements](REQUIREMENTS.md).

## How the game works

The colony advances in **days**. One day passes every eight seconds while the simulation is active. The Pause button stops this clock.

Each dwarf can have one of these local assignments:

| Assignment | Production per day |
|---|---:|
| Woodcutting | 3 wood |
| Deep Mining | 2 stone |
| Mushroom Farm | 4 food |
| Unassigned | No production |

At the end of each day, the colony consumes one food for every dwarf. With the initial company of three dwarves, daily meals therefore consume three food. The Shift Ledger shows current assignments and expected production.

Use the assignment dropdown beside a dwarf to change their work. A changed assignment affects subsequent simulation days.

### Food shortage

Production happens first, then meals. Only dwarves who are present and working produce; a dwarf on an expedition or at the forge produces nothing until they return to their job. Every dwarf eats one food per day, travellers included (they carry provisions).

If the stores run out, dwarves are fed in roster order. A dwarf who could not be fed becomes **hungry** and produces one unit less per day (never below zero) until they are fed again. Food never drops below zero.

A hungry dwarf is too weak to travel or forge and cannot start either task until they are fed again. Hunger only prevents starting a task: a dwarf who goes hungry while crafting or travelling finishes that task, then produces one unit less until fed.

### Resources

The shared inventory contains:

- **Wood**, gathered by woodcutters.
- **Stone**, gathered by miners.
- **Food**, gathered by farmers and consumed by the company.
- **Tools**, produced at the forge or discovered on expeditions.
- **Weapons**, forged at the Ember Forge and stored for the hold's defense.

A tool can be equipped to one dwarf from the roster ("Equip tool" / "Return tool"). While that dwarf works a local job, they produce **one extra unit per day** (e.g. Woodcutting 3 → 4). A dwarf carries at most one tool. Equipping takes a tool from the stores, and returning puts it back. Tools have no durability. A dwarf on an expedition cannot equip or return a tool.

### Ember Forge

Forging is colony work and takes time:

```text
3 wood + 2 stone -> 1 tool    (1 day)
2 wood + 3 stone -> 1 weapon  (2 days)
```

Open the **Forge** page, choose a crafter, and press **Forge tool** or **Forge weapon**. The crafter must be present, not busy, and not hungry, and all materials must be in stock. The materials are paid when forging starts. The forge handles one task at a time: while it runs, the crafter stops their job (but still eats), cannot travel or be reassigned, and the forge shows who is crafting and on which day the item is ready. When that day begins, the item is added to the stores and the crafter returns to their job.

### Expeditions

The expedition panel sends one eligible dwarf to a destination. A dwarf is eligible when they are present, not busy at the forge, and not hungry. Only one expedition can be underway at a time. While the request is in progress, the dwarf is away: they produce nothing (but still eat), cannot be reassigned or start forging, and keep any equipped tool, which travels with them. Every outcome brings the dwarf back: a success adds the destination's rewards exactly once, while a failure, an unreachable server, or no answer within 10 seconds adds nothing and is reported in the chronicle.

The starter destinations:

| Destination | Current outcome |
|---|---|
| Crystal Cave | 8 stone and 1 tool |
| The Old Mine | 12 stone and 2 wood |
| Blocked Pass | A predictable failed expedition |

The short delay is deliberate, so that expedition behavior provides a realistic place to reason about promises, loading state, failures, and consistency between worker and resource state.

### A new resident

Rumours speak of something living in the deep tunnels of **The Old Mine**. After the **first successful** expedition there, **Skritch**, a Tunnel Kobold, follows the scout home and joins Stonehome. He joins only once; failed, timed-out, or reload-interrupted expeditions never bring him.

Kobolds differ from dwarves:

| Job | Dwarf | Kobold |
|---|---:|---:|
| Woodcutting | 3 wood | 2 wood |
| Deep Mining | 2 stone | **4 stone** |
| Mushroom Farm | 4 food | 2 food |

Kobolds also forge **weapons in 1 day** instead of 2 (tools take 1 day for everyone). In every other respect Skritch follows the same rules as the dwarves: he eats one food per day (and is fed last), can go hungry, can carry a tool (+1), can travel and craft when free and fed, and is saved with the colony. The job dropdowns show each resident's own rate, and the forge shows the duration for the selected crafter.

### Save and restore

The colony (day, resources, dwarves, equipped tools, the forge task) and the chronicle are saved in the browser's local storage after every change and restored after a refresh. The game always resumes running; a pause is not saved.

Saved data is validated when it is loaded. Unreadable, incomplete, or incompatible data (for example from an older version) is ignored: a new settlement starts and the chronicle shows a warning.

Tasks interrupted by a refresh follow two rules:
- **Expedition:** the request is lost, so the dwarf returns **empty-handed**.
- **Forge task:** it **continues** and finishes on its original ready day.

Both outcomes are reported in the chronicle after the reload.

## Current starter features

- Three named dwarves with assignments, status, and optional specialization.
- Woodcutting, mining, and farming jobs.
- An automatic eight-second simulation tick with pause/resume.
- Shared wood, stone, food, and tool inventories.
- Daily food consumption.
- One interactive forge recipe.
- Separate colony and forge routes sharing the same running simulation.
- A delayed local expedition API with success and failure outcomes.
- A recent-activity chronicle.
- Responsive fantasy-themed React interface.
- A small Vitest suite for pure simulation behavior.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:5174`; its API runs at `http://localhost:4200`. Available scripts are `dev`, `server`, `build`, `test`, and `preview`.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite frontend and Express API together |
| `npm run server` | Start only the API on port 4200 |
| `npm run build` | Type-check and create a production frontend build |
| `npm run test` | Run the existing Vitest tests once |
| `npm run preview` | Preview a previously created production build |

## API

- `GET /api/health`
- `POST /api/expeditions` with `{ "dwarfId": "dwarf-2", "destination": "crystal-cave" }`

Destinations `crystal-cave` and `old-mine` have rewards. `blocked-pass` is the predictable failure case. Add `?fail=true` to force failure or `?latency=2500` to control delay. The delay is default to two seconds.

## Project orientation

- `src/App.tsx` defines the colony and forge routes.
- `src/state/ColonyProvider.tsx` owns shared colony state, the simulation timer, and game actions.
- `src/state/ColonyContext.ts` exposes the shared state through `useColony`.
- `src/pages/` contains the shared layout, colony page, and forge page.
- `src/simulation.ts` contains the production table and daily simulation transition.
- `src/types.ts` defines workers, jobs, statuses, resources, and activity records.
- `src/api.ts` contains the expedition HTTP request.
- `src/components/` contains the roster, resource display, and shared chronicle.
- `server/index.js` implements the local expedition service.


See [docs/API.md](docs/API.md) for contract details.

See [docs/QUALITY.md](docs/QUALITY.md) for our quality goals and team decisions.

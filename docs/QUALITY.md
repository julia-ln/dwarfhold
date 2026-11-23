# Quality Goals

Dwarfhold is a small single-player browser game, built and maintained by a two-person team under exam conditions. We chose three quality goals that fit this situation. They are listed in priority order: when two goals conflict, the higher one wins.

| # | Goal | In one sentence |
|---|---|---|
| Q1 | Consistent game state | The colony never reaches an impossible state. |
| Q2 | Testability and simplicity | The rules are easy to test, review, and explain. |
| Q3 | Understandable rules | The player can see why something happens. |

## Q1 – Consistent game state

**Why it matters:** In a resource game, every decision is based on the numbers on screen. Invalid states, such as negative food, a dwarf in two places, or rewards counted twice, break the game silently and are hard to notice. D1, D2, D4 and D5 require consistency explicitly.

**Decisions:**
- Game rules are pure functions in `src/simulation.ts` (`advanceDay`, `dailyOutput`, `dailyProduction`, `canTravel`). The same input always gives the same output.
- Fixed rules instead of chance: dwarves are fed in roster order, so a shortage always hits the same dwarves.
- State is updated immutably with functional setters (`setColony(current => …)`). Because `advanceDay` is pure, React Strict Mode's double invocation in development produces the same result.
- Rules are enforced in `ColonyProvider` (`assignDwarf`, `sendExpedition`), not only by disabled UI controls.
- A dwarf has exactly one `status`, so working and travelling at the same time is impossible by construction.
- We store only what cannot be derived. `hungry` is stored because it depends on yesterday's meal; production totals, hungry counts, and warnings are computed during render.

**Trade-off:** Some checks exist twice, once in the UI for convenience and once in the logic for correctness. We accept this small duplication.

**How we evaluate it:**
- Unit tests for the invariants in `src/simulation.test.ts`: food never drops below 0, idle and travelling dwarves produce nothing, unfed dwarves become hungry, hungry or absent dwarves cannot travel.
- Planned: rewards are applied exactly once (D4), and corrupt saves fall back safely (D5).
- A manual scenario check before every pull request.

## Q2 – Testability and simplicity

**Why it matters:** We are two developers with limited time, and both of us must be able to explain every line in the exam. Simple code is faster to review, test, and defend.

**Decisions:**
- Clear layers: components render the UI, `ColonyProvider` owns state and actions, `simulation.ts` holds the game rules, and `api.ts` handles HTTP calls.
- `useState` and context instead of a state-management library. No new dependencies without a team decision. We will switch to `useReducer` only if state transitions become scattered.
- Derived values are computed during render: no `useEffect` for derived state, and no `useMemo` without a measured need.

**Trade-off:** Fewer abstractions mean some repetition, for example the chronicle entries in the provider. We accept this until it causes real problems.

**How we evaluate it:**
- Quality gates before every pull request: `npm run test` and `npm run build` (including the type check) must pass.
- Every new game rule gets at least one unit test.
- Every pull request is reviewed by the other team member before merging.

## Q3 – Understandable rules

**Why it matters:** Players can only make good decisions if they understand the consequences. D1 ("explained in the interface"), D3 ("who is crafting and when") and D6 ("differences visible") require this. Hidden rules feel like bugs.

**Decisions:**
- The Shift Ledger uses the same `dailyProduction` function as the simulation, so the forecast always matches what actually happens.
- Each dwarf shows a status tag and, when needed, a Hungry tag. The ledger warns before and during a food shortage.
- Blocked actions are disabled and explain why (for example, a hungry scout).
- All rules are described in the README.

**Trade-off:** More text and space in the interface. We keep each explanation to one short line.

**How we evaluate it:**
- The ledger forecast matches the actual resource change on the next day.
- Every disabled control shows a reason.
- A person new to the game plays for five minutes and can explain why a dwarf is hungry.

## Decision log

| Req. | Decision | Goal | Evidence |
|---|---|---|---|
| D1 | Only working dwarves produce; travellers still eat | Q1 | `dailyOutput`, test "travelling dwarf…" |
| D1 | Shortage: fed in roster order, unfed dwarves are hungry and produce 1 less | Q1, Q3 | `advanceDay`, tests "roster order", "hungry" |
| D1 | "1 less" instead of "half": no rounding, adds up cleanly with the +1 tool bonus (D2) | Q2, Q3 | README "Food shortage" |
| D1 | Hungry or absent dwarves cannot travel (`canTravel`), enforced in the provider | Q1 | `canTravel`, test "only lets present, fed dwarves travel" |
| D1 | The ledger shows real totals from `dailyProduction`; shortage messages are derived, not stored | Q1, Q3 | `ColonyPage.tsx` |
| D2 | Tools in stores (`resources.tools`) + `hasTool` per dwarf; the total is derived, never stored | Q1 | `equipTool`/`returnTool`, test "moves one tool…" |
| D2 | One tool type, +1 on all local jobs; additive with hunger | Q2, Q3 | `dailyOutput`, test "cancel out" |
| D2 | Weapon: 2 wood + 3 stone; one recipe table with one `canAfford` check (also fixes negative stone) | Q1, Q2 | `recipes`, `canAfford`, test "refuses to start forging…" |
| D3 | Crafting takes game days (tool 1, weapon 2); pauses with the game clock | Q1, Q3 | `recipes.days`, `finishForgeTask` |
| D3 | One forge task at a time (`forgeTask`); materials paid at the start | Q1, Q2 | `canStartCraft`, `startCraft`, test "refuses…" |
| D3 | Crafter status `crafting`: no production, still eats, cannot travel or be reassigned | Q1 | `isFree`, test "finishes the item…" |
| D3 | No chronicle entry on completion: `advanceDay` must stay pure; completion is visible on the forge panel and resource tile | Q2 | `ForgePage.tsx` |
| D3 | Hunger blocks starting a task but does not interrupt a running one (crafting or travel) | Q2, Q3 | `canCraft`, `canTravel`, test "keeps forging when the crafter goes hungry" |
| D4 | Rewards exactly once: `endExpedition` acts only while the dwarf is away | Q1 | `endExpedition`, test "applies the rewards exactly once" |
| D4 | Every outcome (success, error, timeout after 10 s) brings the dwarf back | Q1, Q3 | `sendExpedition` (`finally`), `api.ts`, test "…after a failure" |
| D4 | Synchronous in-flight guard (`useRef`) against repeated clicks; one expedition at a time | Q1, Q2 | `ColonyProvider.tsx` |
| D4 | An equipped tool travels with the dwarf | Q2, Q3 | test "…with the rewards and their tool" |
| D4 | Rewards are validated: only known resources with positive whole numbers | Q1 | test "ignores unknown or negative rewards" |
| D5 | Saved data is parsed as `unknown` and validated field by field (no type assertion as validation); invalid data starts a new game with a warning | Q1, Q3 | `parseSave`, test "rejects corrupt…" |
| D5 | Save format has a version number; a different version counts as incompatible | Q1 | `SAVE_VERSION` |
| D5 | Interrupted expedition returns empty-handed; interrupted forge task continues | Q1, Q3 | `resumeAfterReload`, tests "…after a reload" |
| D5 | One storage module; load once (lazy initializer), save in an effect; pause is not saved | Q2 | `storage.ts`, `ColonyProvider.tsx` |
| D6 | Species traits (production, forge days) in one table; the newcomer is a normal resident, so all existing rules apply without special cases | Q2 | `speciesTraits`, `dailyOutput`, `craftDays` |
| D6 | "Has joined" is derived from the roster, not stored; `welcomeNewcomer` is idempotent and only runs after success | Q1 | test "lets the kobold join once…" |
| D6 | Old saves stay compatible: a missing `species` means "dwarf"; unknown species are rejected | Q1 | `parseDwarf`, test "loads old saves…" |
| D6 | Job dropdowns show each resident's own rate; forge shows the crafter's duration; a rumour hint names the destination | Q3 | `DwarfRoster.tsx`, `ForgePage.tsx`, `ColonyPage.tsx` |
| D6 | Job dropdowns show the real rate (species, tool, hunger) via `jobRate`, which reuses `dailyOutput` | Q1, Q3 | `jobRate`, test "shows the real job rate…" |
| D7 | The raid result is computed inside the state update from the current state and stored as `lastRaid`; the UI derives its report from it (no message built from the stale snapshot at departure) | Q1, Q3 | `raidAfterExpedition`, raid report panel |
| D7 | Raid only in the success chain: failures, timeouts, and reload-lost expeditions never trigger it | Q1 | `sendExpedition` |
| D7 | Threshold 3 weapons, used up on defense; otherwise half of wood/stone/food (rounded down) is looted, never below 0 | Q1, Q3 | tests "repels…", "loses half…", "never loots below zero" |
| D7 | Old saves stay compatible: a missing raid report means "no raid yet"; broken reports are rejected | Q1 | `parseColony`, test "loads saves without a raid report…" |

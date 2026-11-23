import type {
  Activity,
  ColonyState,
  Dwarf,
  JobType,
  RecipeId,
  ResourceKey,
  Resources,
  Species,
} from "./types";

export type { RecipeId } from "./types";

type Job = Exclude<JobType, null>;

export interface SpeciesTraits {
  label: string;
  production: Record<Job, Partial<Resources>>;
  /** Faster (or slower) forging per recipe; missing recipes use the recipe's own days. */
  forgeDays?: Partial<Record<RecipeId, number>>;
}

export const speciesTraits: Record<Species, SpeciesTraits> = {
  dwarf: {
    label: "Dwarf",
    production: {
      woodcutting: { wood: 3 },
      mining: { stone: 2 },
      farming: { food: 4 },
    },
  },
  kobold: {
    label: "Kobold",
    production: {
      woodcutting: { wood: 2 },
      mining: { stone: 4 },
      farming: { food: 2 },
    },
    forgeDays: { weapon: 1 },
  },
};

/** Dwarf rates. The job cards use it to know which resource a job produces. */
export const production = speciesTraits.dwarf.production;

export const HUNGER_PENALTY = 1;
export const TOOL_BONUS = 1;

/** What one dwarf adds to the stores today. Only working dwarves produce. */
export function dailyOutput(dwarf: Dwarf): Partial<Resources> {
  if (dwarf.status !== "working" || !dwarf.assignment) return {};

  const bonus = dwarf.hasTool ? TOOL_BONUS : 0;
  const penalty = dwarf.hungry ? HUNGER_PENALTY : 0;
  const output: Partial<Resources> = {};
  for (const [resource, amount] of Object.entries(
    speciesTraits[dwarf.species].production[dwarf.assignment],
  )) {
    output[resource as keyof Resources] = Math.max(
      0,
      (amount ?? 0) + bonus - penalty,
    );
  }
  return output;
}

/** What this resident would produce per day in a job, including species, tool and hunger. */
export function jobRate(dwarf: Dwarf, job: Exclude<JobType, null>): number {
  const output = dailyOutput({ ...dwarf, assignment: job, status: "working" });
  return Object.values(output)[0] ?? 0;
}

/** Total production of the whole company for one day. */
export function dailyProduction(dwarves: Dwarf[]): Resources {
  const total: Resources = { wood: 0, stone: 0, food: 0, tools: 0, weapons: 0 };
  for (const dwarf of dwarves) {
    for (const [resource, amount] of Object.entries(dailyOutput(dwarf))) {
      total[resource as keyof Resources] += amount ?? 0;
    }
  }
  return total;
}

/** Present and not busy with another task. */
export function isFree(dwarf: Dwarf): boolean {
  return dwarf.status === "working" || dwarf.status === "idle";
}

/** A dwarf may travel only if they are free and not hungry. */
export function canTravel(dwarf: Dwarf): boolean {
  return isFree(dwarf) && !dwarf.hungry;
}

/** A dwarf may craft only if they are free and not hungry. */
export function canCraft(dwarf: Dwarf): boolean {
  return isFree(dwarf) && !dwarf.hungry;
}

export interface Recipe {
  name: string;
  cost: Partial<Resources>;
  output: ResourceKey;
  days: number;
}

export const recipes: Record<RecipeId, Recipe> = {
  tool: { name: "tool", cost: { wood: 3, stone: 2 }, output: "tools", days: 1 },
  weapon: {
    name: "weapon",
    cost: { wood: 2, stone: 3 },
    output: "weapons",
    days: 2,
  },
};

/** How many days this crafter needs for a recipe (kobolds forge weapons faster). */
export function craftDays(crafter: Dwarf, recipeId: RecipeId): number {
  return (
    speciesTraits[crafter.species].forgeDays?.[recipeId] ??
    recipes[recipeId].days
  );
}

export function canAfford(
  resources: Resources,
  cost: Partial<Resources>,
): boolean {
  return Object.entries(cost).every(
    ([resource, amount]) => resources[resource as ResourceKey] >= (amount ?? 0),
  );
}

/** The forge is free, the crafter is eligible, and the materials are in stock. */
export function canStartCraft(
  state: ColonyState,
  recipeId: RecipeId,
  crafterId: string,
): boolean {
  const crafter = state.dwarves.find((dwarf) => dwarf.id === crafterId);
  return (
    state.forgeTask === null &&
    crafter !== undefined &&
    canCraft(crafter) &&
    canAfford(state.resources, recipes[recipeId].cost)
  );
}

/** Pays the materials and occupies the crafter. Invalid attempts leave the state unchanged. */
export function startCraft(
  state: ColonyState,
  recipeId: RecipeId,
  crafterId: string,
): ColonyState {
  const crafter = state.dwarves.find((dwarf) => dwarf.id === crafterId);
  if (!crafter || !canStartCraft(state, recipeId, crafterId)) return state;

  const recipe = recipes[recipeId];
  const resources = { ...state.resources };
  for (const [resource, amount] of Object.entries(recipe.cost)) {
    resources[resource as ResourceKey] -= amount ?? 0;
  }

  return {
    ...state,
    resources,
    dwarves: state.dwarves.map(
      (dwarf): Dwarf =>
        dwarf.id === crafterId ? { ...dwarf, status: "crafting" } : dwarf,
    ),
    forgeTask: {
      recipeId,
      crafterId,
      readyOnDay: state.day + craftDays(crafter, recipeId),
    },
  };
}

/** On the ready day: adds the item, sends the crafter back to work, and frees the forge. */
function finishForgeTask(state: ColonyState): ColonyState {
  const task = state.forgeTask;
  if (!task || state.day < task.readyOnDay) return state;

  const resources = { ...state.resources };
  resources[recipes[task.recipeId].output] += 1;

  return {
    ...state,
    resources,
    dwarves: state.dwarves.map(
      (dwarf): Dwarf =>
        dwarf.id === task.crafterId
          ? { ...dwarf, status: dwarf.assignment ? "working" : "idle" }
          : dwarf,
    ),
    forgeTask: null,
  };
}

/** A dwarf may take a tool if they carry none, are present, and the stores have one. */
export function canEquipTool(dwarf: Dwarf, toolsInStore: number): boolean {
  return !dwarf.hasTool && dwarf.status !== "expedition" && toolsInStore > 0;
}

/** A dwarf may return a tool if they carry one and are present. */
export function canReturnTool(dwarf: Dwarf): boolean {
  return dwarf.hasTool && dwarf.status !== "expedition";
}

/** Moves one tool from the stores to the dwarf. Invalid moves leave the state unchanged. */
export function equipTool(state: ColonyState, dwarfId: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf || !canEquipTool(dwarf, state.resources.tools)) return state;

  return {
    ...state,
    resources: { ...state.resources, tools: state.resources.tools - 1 },
    dwarves: state.dwarves.map((item) =>
      item.id === dwarfId ? { ...item, hasTool: true } : item,
    ),
  };
}

/** Moves the dwarf's tool back to the stores. Invalid moves leave the state unchanged. */
export function returnTool(state: ColonyState, dwarfId: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf || !canReturnTool(dwarf)) return state;

  return {
    ...state,
    resources: { ...state.resources, tools: state.resources.tools + 1 },
    dwarves: state.dwarves.map((item) =>
      item.id === dwarfId ? { ...item, hasTool: false } : item,
    ),
  };
}

/** Sends a dwarf on an expedition. Ineligible dwarves leave the state unchanged. */
export function departExpedition(
  state: ColonyState,
  dwarfId: string,
): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf || !canTravel(dwarf)) return state;

  return {
    ...state,
    dwarves: state.dwarves.map(
      (item): Dwarf =>
        item.id === dwarfId ? { ...item, status: "expedition" } : item,
    ),
  };
}

/**
 * Brings a travelling dwarf home and adds the rewards (none after a failure).
 * Acts only while the dwarf is away, so rewards are applied exactly once.
 */
export function endExpedition(
  state: ColonyState,
  dwarfId: string,
  rewards: Partial<Resources> = {},
): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId);
  if (!dwarf || dwarf.status !== "expedition") return state;

  const resources = { ...state.resources };
  for (const [resource, amount] of Object.entries(rewards)) {
    if (resource in resources && Number.isInteger(amount) && amount > 0) {
      resources[resource as ResourceKey] += amount;
    }
  }

  return {
    ...state,
    resources,
    dwarves: state.dwarves.map(
      (item): Dwarf =>
        item.id === dwarfId
          ? { ...item, status: item.assignment ? "working" : "idle" }
          : item,
    ),
  };
}

export const NEWCOMER_DESTINATION = "old-mine";

export const newcomer: Dwarf = {
  id: "kobold-1",
  name: "Skritch",
  title: "Tunnel Delver",
  icon: "🦎",
  species: "kobold",
  specialty: "mining",
  assignment: null,
  status: "idle",
  hungry: false,
  hasTool: false,
};

/** Derived, not stored: residents never leave, so this is enough for "only once". */
export function hasNewcomerJoined(state: ColonyState): boolean {
  return state.dwarves.some((dwarf) => dwarf.id === newcomer.id);
}

/** After a successful expedition: Skritch joins once, and only from the Old Mine. */
export function welcomeNewcomer(state: ColonyState, destination: string): ColonyState {
  if (destination !== NEWCOMER_DESTINATION || hasNewcomerJoined(state)) return state;
  return { ...state, dwarves: [...state.dwarves, newcomer] };
}

export const RAID_DESTINATION = "howling-depths";
export const DEFENSE_THRESHOLD = 3;

/** After a successful expedition to the Howling Depths, raiders attack the hold. */
export function raidAfterExpedition(state: ColonyState, destination: string): ColonyState {
  if (destination !== RAID_DESTINATION) return state;

  const { wood, stone, food, weapons } = state.resources;

  // Enough weapons: the raid is repelled, and the weapons break.
  if (weapons >= DEFENSE_THRESHOLD) {
    return {
      ...state,
      resources: { ...state.resources, weapons: weapons - DEFENSE_THRESHOLD },
      lastRaid: {
        day: state.day,
        defended: true,
        weaponsLost: DEFENSE_THRESHOLD,
        loot: { wood: 0, stone: 0, food: 0 },
      },
    };
  }

  // Not enough weapons: the raiders take half of wood, stone, and food (rounded down).
  const loot = {
    wood: Math.floor(wood / 2),
    stone: Math.floor(stone / 2),
    food: Math.floor(food / 2),
  };

  return {
    ...state,
    resources: {
      ...state.resources,
      wood: wood - loot.wood,
      stone: stone - loot.stone,
      food: food - loot.food,
    },
    lastRaid: { day: state.day, defended: false, weaponsLost: 0, loot },
  };
}

export function advanceDay(state: ColonyState): ColonyState {
  const resources = { ...state.resources };

  // 1. Production
  for (const [resource, amount] of Object.entries(
    dailyProduction(state.dwarves),
  )) {
    resources[resource as keyof Resources] += amount;
  }

  // 2. Meals: one food per dwarf, served in roster order. Unfed dwarves go hungry.
  const dwarves = state.dwarves.map((dwarf) => {
    if (resources.food > 0) {
      resources.food -= 1;
      return { ...dwarf, hungry: false };
    }
    return { ...dwarf, hungry: true };
  });

  // 3. Forge: finish the task once its ready day is reached.
  return finishForgeTask({ ...state, day: state.day + 1, resources, dwarves });
}

type ReloadNote = { message: string; tone?: Activity["tone"] };

/** Refresh policy: lost expeditions return empty-handed; forge tasks continue. */
export function resumeAfterReload(state: ColonyState): {
  colony: ColonyState;
  notes: ReloadNote[];
} {
  let colony = state;
  const notes: ReloadNote[] = [];

  for (const dwarf of state.dwarves) {
    if (dwarf.status === "expedition") {
      colony = endExpedition(colony, dwarf.id);
      notes.push({
        message: `${dwarf.name} returned empty-handed: the expedition report was lost when the hold was reloaded.`,
        tone: "warning",
      });
    }
  }

  const task = state.forgeTask;
  if (task) {
    const crafter = state.dwarves.find((dwarf) => dwarf.id === task.crafterId);
    notes.push({
      message: `${crafter?.name ?? "A crafter"} continues forging a ${recipes[task.recipeId].name} (ready on day ${task.readyOnDay}).`,
    });
  }

  return { colony, notes };
}

export const jobLabel = (job: JobType) =>
  job
    ? {
        woodcutting: "Woodcutting",
        mining: "Deep Mining",
        farming: "Mushroom Farm",
      }[job]
    : "Unassigned";

import type {
  ColonyState,
  Dwarf,
  JobType,
  RecipeId,
  ResourceKey,
  Resources,
} from "./types";

export type { RecipeId } from "./types";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 },
  mining: { stone: 2 },
  farming: { food: 4 },
};

export const HUNGER_PENALTY = 1;
export const TOOL_BONUS = 1;

/** What one dwarf adds to the stores today. Only working dwarves produce. */
export function dailyOutput(dwarf: Dwarf): Partial<Resources> {
  if (dwarf.status !== "working" || !dwarf.assignment) return {};

  const bonus = dwarf.hasTool ? TOOL_BONUS : 0;
  const penalty = dwarf.hungry ? HUNGER_PENALTY : 0;
  const output: Partial<Resources> = {};
  for (const [resource, amount] of Object.entries(
    production[dwarf.assignment],
  )) {
    output[resource as keyof Resources] = Math.max(
      0,
      (amount ?? 0) + bonus - penalty,
    );
  }
  return output;
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
  if (!canStartCraft(state, recipeId, crafterId)) return state;

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
    forgeTask: { recipeId, crafterId, readyOnDay: state.day + recipe.days },
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

export const jobLabel = (job: JobType) =>
  job
    ? {
        woodcutting: "Woodcutting",
        mining: "Deep Mining",
        farming: "Mushroom Farm",
      }[job]
    : "Unassigned";

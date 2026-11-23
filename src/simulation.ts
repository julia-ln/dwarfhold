import type { ColonyState, Dwarf, JobType, Resources } from "./types";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 },
  mining: { stone: 2 },
  farming: { food: 4 },
};

export const HUNGER_PENALTY = 1;

/** What one dwarf adds to the stores today. Only working dwarves produce. */
export function dailyOutput(dwarf: Dwarf): Partial<Resources> {
  if (dwarf.status !== "working" || !dwarf.assignment) return {};

  const penalty = dwarf.hungry ? HUNGER_PENALTY : 0;
  const output: Partial<Resources> = {};
  for (const [resource, amount] of Object.entries(
    production[dwarf.assignment],
  )) {
    output[resource as keyof Resources] = Math.max(0, (amount ?? 0) - penalty);
  }
  return output;
}

/** Total production of the whole company for one day. */
export function dailyProduction(dwarves: Dwarf[]): Resources {
  const total: Resources = { wood: 0, stone: 0, food: 0, tools: 0 };
  for (const dwarf of dwarves) {
    for (const [resource, amount] of Object.entries(dailyOutput(dwarf))) {
      total[resource as keyof Resources] += amount ?? 0;
    }
  }
  return total;
}

/** A dwarf may travel only if they are present and not hungry. */
export function canTravel(dwarf: Dwarf): boolean {
  return dwarf.status !== "expedition" && !dwarf.hungry;
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

  return { ...state, day: state.day + 1, resources, dwarves };
}

export const jobLabel = (job: JobType) =>
  job
    ? {
        woodcutting: "Woodcutting",
        mining: "Deep Mining",
        farming: "Mushroom Farm",
      }[job]
    : "Unassigned";

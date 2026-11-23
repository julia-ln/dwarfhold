import { recipes } from "./simulation";
import type { Activity, ColonyState, Dwarf, ForgeTask, Resources } from "./types";

export const SAVE_KEY = "dwarfhold-save";
export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  colony: ColonyState;
  activities: Activity[];
}

export type LoadResult =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "ok"; save: SaveData };

const RESOURCE_KEYS = ["wood", "stone", "food", "tools", "weapons"] as const;
const JOBS = ["woodcutting", "mining", "farming"];
const STATUSES = ["idle", "working", "expedition", "crafting"];
const MAX_ACTIVITIES = 6;

// ---- small runtime checks ----

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/** Parses every item; the whole list is invalid if one item is. */
function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(parse);
  return items.every((item) => item !== null) ? (items as T[]) : null;
}

// ---- parts of the save ----

function parseResources(value: unknown): Resources | null {
  if (!isObject(value) || !RESOURCE_KEYS.every((key) => isCount(value[key]))) return null;
  return {
    wood: value.wood as number,
    stone: value.stone as number,
    food: value.food as number,
    tools: value.tools as number,
    weapons: value.weapons as number,
  };
}

function parseDwarf(value: unknown): Dwarf | null {
  if (!isObject(value)) return null;
  const { id, name, title, icon, assignment, status, specialty, hungry, hasTool } = value;

  if (!isString(id) || !isString(name) || !isString(title) || !isString(icon)) return null;
  if (assignment !== null && !JOBS.includes(assignment as string)) return null;
  if (!STATUSES.includes(status as string)) return null;
  if (specialty !== undefined && !JOBS.includes(specialty as string)) return null;
  if (typeof hungry !== "boolean" || typeof hasTool !== "boolean") return null;
  // Working means having a job; idle means having none.
  if (status === "working" && assignment === null) return null;
  if (status === "idle" && assignment !== null) return null;

  return {
    id,
    name,
    title,
    icon,
    assignment: assignment as Dwarf["assignment"],
    status: status as Dwarf["status"],
    specialty: specialty as Dwarf["specialty"],
    hungry,
    hasTool,
  };
}

function parseActivity(value: unknown): Activity | null {
  if (!isObject(value)) return null;
  const { id, day, message, tone } = value;

  if (!isString(id) || !Number.isInteger(day) || !isString(message)) return null;
  if (tone !== undefined && tone !== "good" && tone !== "warning") return null;

  return { id, day: day as number, message, tone: tone as Activity["tone"] };
}

function parseColony(value: unknown): ColonyState | null {
  if (!isObject(value) || !Number.isInteger(value.day) || (value.day as number) < 1) return null;

  const resources = parseResources(value.resources);
  const dwarves = parseList(value.dwarves, parseDwarf);
  if (!resources || !dwarves || dwarves.length === 0) return null;
  if (new Set(dwarves.map((dwarf) => dwarf.id)).size !== dwarves.length) return null;

  let forgeTask: ForgeTask | null = null;
  if (value.forgeTask !== null) {
    const task = value.forgeTask;
    if (
      !isObject(task) ||
      !Object.keys(recipes).includes(task.recipeId as string) ||
      !isString(task.crafterId) ||
      !Number.isInteger(task.readyOnDay)
    ) {
      return null;
    }
    forgeTask = {
      recipeId: task.recipeId as ForgeTask["recipeId"],
      crafterId: task.crafterId,
      readyOnDay: task.readyOnDay as number,
    };
  }

  // A dwarf is crafting exactly when they are the forge task's crafter.
  const crafters = dwarves.filter((dwarf) => dwarf.status === "crafting").map((dwarf) => dwarf.id);
  const expected = forgeTask ? [forgeTask.crafterId] : [];
  if (crafters.join() !== expected.join()) return null;

  return { day: value.day as number, resources, dwarves, forgeTask };
}

// ---- public API ----

/** Validates parsed JSON. Returns a trusted save, or null if anything is wrong. */
export function parseSave(value: unknown): SaveData | null {
  if (!isObject(value) || value.version !== SAVE_VERSION) return null;

  const colony = parseColony(value.colony);
  const activities = parseList(value.activities, parseActivity);
  if (!colony || !activities || activities.length > MAX_ACTIVITIES) return null;

  return { version: SAVE_VERSION, colony, activities };
}

export function loadGame(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { status: "empty" }; // storage blocked (e.g. privacy settings)
  }
  if (raw === null) return { status: "empty" };

  try {
    const save = parseSave(JSON.parse(raw));
    return save ? { status: "ok", save } : { status: "invalid" };
  } catch {
    return { status: "invalid" }; // not valid JSON
  }
}

export function saveGame(colony: ColonyState, activities: Activity[]): void {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: SAVE_VERSION, colony, activities }),
    );
  } catch {
    // Storage full or blocked: the game keeps running without saving.
  }
}

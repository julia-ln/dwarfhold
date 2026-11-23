import { useEffect, useRef, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import {
  advanceDay,
  canEquipTool,
  canReturnTool,
  canStartCraft,
  canTravel,
  departExpedition,
  endExpedition,
  equipTool,
  isFree,
  jobLabel,
  recipes,
  returnTool,
  startCraft,
  type RecipeId,
  resumeAfterReload,
} from "../simulation";
import type { Activity, ColonyState, JobType } from "../types";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";
import { loadGame, saveGame } from "../storage";

const initialState: ColonyState = {
  day: 12,
  resources: {
    wood: 14,
    stone: 9,
    food: 18,
    tools: 1,
    weapons: 0,
  },
  dwarves: [
    {
      id: "dwarf-1",
      name: "Bromli Copperkeg",
      title: "Hold Warden",
      icon: "🧔🏻",
      assignment: "mining",
      status: "working",
      specialty: "mining",
      hungry: false,
      hasTool: false,
    },
    {
      id: "dwarf-2",
      name: "Yrsa Flintbraid",
      title: "Trail Scout",
      icon: "🧔🏼‍♀️",
      assignment: "woodcutting",
      status: "working",
      specialty: "woodcutting",
      hungry: false,
      hasTool: false,
    },
    {
      id: "dwarf-3",
      name: "Dori Ashmantle",
      title: "Stone Singer",
      icon: "🧔🏽",
      assignment: null,
      status: "idle",
      hungry: false,
      hasTool: false,
    },
  ],
  forgeTask: null,
};

const welcome: Activity = {
  id: "welcome",
  day: initialState.day,
  message: "The forge fires are lit. Stonehome wakes.",
};

/** Reads the save once at startup and applies the refresh policy. */
function loadStartup(): { colony: ColonyState; activities: Activity[] } {
  const loaded = loadGame();

  if (loaded.status === "empty") {
    return { colony: initialState, activities: [welcome] };
  }

  if (loaded.status === "invalid") {
    return {
      colony: initialState,
      activities: [
        {
          id: "invalid-save",
          day: initialState.day,
          message:
            "The saved records were unreadable. A new settlement begins.",
          tone: "warning",
        },
        welcome,
      ],
    };
  }

  const { colony, notes } = resumeAfterReload(loaded.save.colony);
  const restored: Activity[] = [
    { message: `The hold restores its records (day ${colony.day}).` },
    ...notes,
  ].map((note) => ({ id: crypto.randomUUID(), day: colony.day, ...note }));

  return {
    colony,
    activities: [...restored, ...loaded.save.activities].slice(0, 6),
  };
}

export function ColonyProvider({ children }: { children: ReactNode }) {
  const [startup] = useState(loadStartup);
  const [colony, setColony] = useState(startup.colony);
  const [paused, setPaused] = useState(false);
  const [expeditionPending, setExpeditionPending] = useState(false);
  const expeditionInFlight = useRef(false);
  const [activities, setActivities] = useState(startup.activities);

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(
      () => setColony((current) => advanceDay(current)),
      8_000,
    );

    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    saveGame(colony, activities);
  }, [colony, activities]);

  function assignDwarf(id: string, assignment: JobType) {
    const dwarf = colony.dwarves.find((item) => item.id === id);
    if (!dwarf || !isFree(dwarf)) return;

    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((item) =>
        item.id === id && isFree(item)
          ? { ...item, assignment, status: assignment ? "working" : "idle" }
          : item,
      ),
    }));

    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${dwarf.name} assigned to ${jobLabel(assignment)}.`,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  function addActivity(message: string, tone?: Activity["tone"]) {
    setActivities((current) =>
      [
        { id: crypto.randomUUID(), day: colony.day, message, tone },
        ...current,
      ].slice(0, 6),
    );
  }

  function equip(id: string) {
    const dwarf = colony.dwarves.find((item) => item.id === id);
    if (!dwarf || !canEquipTool(dwarf, colony.resources.tools)) return;

    setColony((current) => equipTool(current, id));
    addActivity(`${dwarf.name} takes a tool from the stores.`);
  }

  function unequip(id: string) {
    const dwarf = colony.dwarves.find((item) => item.id === id);
    if (!dwarf || !canReturnTool(dwarf)) return;

    setColony((current) => returnTool(current, id));
    addActivity(`${dwarf.name} returns a tool to the stores.`);
  }

  function forge(recipeId: RecipeId, crafterId: string) {
    const crafter = colony.dwarves.find((item) => item.id === crafterId);
    if (!crafter || !canStartCraft(colony, recipeId, crafterId)) return;

    const recipe = recipes[recipeId];
    setColony((current) => startCraft(current, recipeId, crafterId));
    addActivity(
      `${crafter.name} starts forging a ${recipe.name} (ready on day ${colony.day + recipe.days}).`,
    );
  }

  async function sendExpedition(dwarfId: string, destination: string) {
    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    if (!dwarf || !canTravel(dwarf) || expeditionInFlight.current) return;

    expeditionInFlight.current = true;
    setExpeditionPending(true);
    setColony((current) => departExpedition(current, dwarfId));
    addActivity(`${dwarf.name} departed for ${destination.replace("-", " ")}.`);

    try {
      const result = await beginExpedition(dwarfId, destination);
      setColony((current) =>
        endExpedition(current, dwarfId, result.rewards ?? {}),
      );
      addActivity(result.message, "good");
    } catch (error) {
      setColony((current) => endExpedition(current, dwarfId));
      const reason =
        error instanceof Error
          ? error.message
          : "The expedition was lost from view.";
      addActivity(`${reason} ${dwarf.name} returned empty-handed.`, "warning");
    } finally {
      expeditionInFlight.current = false;
      setExpeditionPending(false);
    }
  }

  function resetGame() {
    setColony(initialState);
    setActivities([welcome]);
  }

  const value: ColonyContextValue = {
    colony,
    paused,
    activities,
    expeditionPending,
    togglePaused: () => setPaused((value) => !value),
    assignDwarf,
    equip,
    unequip,
    forge,
    sendExpedition,
    resetGame,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}

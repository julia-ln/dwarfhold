import { describe, expect, it } from "vitest";
import {
  advanceDay,
  canTravel,
  dailyOutput,
  departExpedition,
  endExpedition,
  equipTool,
  jobRate,
  resumeAfterReload,
  returnTool,
  startCraft,
  welcomeNewcomer,
} from "./simulation";
import { parseSave } from "./storage";
import type { ColonyState, Dwarf, Resources } from "./types";

const dwarf = (overrides: Partial<Dwarf> = {}): Dwarf => ({
  id: "d1",
  name: "Brom",
  title: "",
  icon: "",
  assignment: "woodcutting",
  status: "working",
  hungry: false,
  hasTool: false,
  species: "dwarf",
  ...overrides,
});

const colony = (
  food: number,
  dwarves: Dwarf[],
  extra: Partial<Resources> = {},
): ColonyState => ({
  day: 1,
  resources: { wood: 0, stone: 0, food, tools: 0, weapons: 0, ...extra },
  dwarves,
  forgeTask: null,
});

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value));

const validSave = () =>
  roundTrip({
    version: 1,
    colony: colony(5, [dwarf()]),
    activities: [{ id: "a1", day: 1, message: "The forge fires are lit." }],
  });

describe("colony simulation", () => {
  it("produces assigned resources and feeds the company", () => {
    const state = colony(5, [dwarf()]);
    expect(advanceDay(state)).toMatchObject({
      day: 2,
      resources: { wood: 3, food: 4 },
    });
    expect(state.resources.wood).toBe(0); // input not mutated
  });

  it("gives no production for an idle dwarf", () => {
    expect(dailyOutput(dwarf({ assignment: null, status: "idle" }))).toEqual(
      {},
    );
  });

  it("does not let a travelling dwarf produce, but they still eat", () => {
    const next = advanceDay(colony(5, [dwarf({ status: "expedition" })]));
    expect(next.resources).toMatchObject({ wood: 0, food: 4 });
  });

  it("feeds dwarves in roster order and marks the unfed as hungry", () => {
    const idle = { assignment: null, status: "idle" } as const;
    const next = advanceDay(
      colony(1, [dwarf({ id: "a", ...idle }), dwarf({ id: "b", ...idle })]),
    );
    expect(next.resources.food).toBe(0);
    expect(next.dwarves.map((d) => d.hungry)).toEqual([false, true]);
  });

  it("lets hungry dwarves produce 1 less and recover once fed", () => {
    const next = advanceDay(colony(5, [dwarf({ hungry: true })]));
    expect(next.resources.wood).toBe(2);
    expect(next.dwarves[0].hungry).toBe(false);
  });

  it("only lets present, fed dwarves travel", () => {
    expect(canTravel(dwarf())).toBe(true);
    expect(canTravel(dwarf({ hungry: true }))).toBe(false);
    expect(canTravel(dwarf({ status: "expedition" }))).toBe(false);
  });

  it("gives a working dwarf with a tool 1 extra", () => {
    expect(dailyOutput(dwarf({ hasTool: true }))).toEqual({ wood: 4 });
  });

  it("lets the tool bonus and the hunger penalty cancel out", () => {
    expect(dailyOutput(dwarf({ hasTool: true, hungry: true }))).toEqual({
      wood: 3,
    });
  });

  it("gives no bonus to an idle dwarf carrying a tool", () => {
    expect(
      dailyOutput(dwarf({ hasTool: true, assignment: null, status: "idle" })),
    ).toEqual({});
  });

  it("moves one tool from the stores to the dwarf and back", () => {
    const equipped = equipTool(colony(5, [dwarf()], { tools: 1 }), "d1");
    expect(equipped.resources.tools).toBe(0);
    expect(equipped.dwarves[0].hasTool).toBe(true);

    const returned = returnTool(equipped, "d1");
    expect(returned.resources.tools).toBe(1);
    expect(returned.dwarves[0].hasTool).toBe(false);
  });

  it("refuses to equip without a free tool, twice, or while away", () => {
    const empty = colony(5, [dwarf()]);
    expect(equipTool(empty, "d1")).toBe(empty);

    const carrying = colony(5, [dwarf({ hasTool: true })], { tools: 1 });
    expect(equipTool(carrying, "d1")).toBe(carrying);

    const away = colony(5, [dwarf({ status: "expedition" })], { tools: 1 });
    expect(equipTool(away, "d1")).toBe(away);
  });

  it("starts forging: pays the cost, occupies the crafter, and sets the ready day", () => {
    const next = startCraft(
      colony(5, [dwarf()], { wood: 2, stone: 3 }),
      "weapon",
      "d1",
    );
    expect(next.resources).toMatchObject({ wood: 0, stone: 0, weapons: 0 });
    expect(next.dwarves[0].status).toBe("crafting");
    expect(next.forgeTask).toEqual({
      recipeId: "weapon",
      crafterId: "d1",
      readyOnDay: 3,
    });
  });

  it("refuses to start forging when the forge is busy, materials are missing, or the crafter is not free and fed", () => {
    const busy: ColonyState = {
      ...colony(5, [dwarf()], { wood: 9, stone: 9 }),
      forgeTask: { recipeId: "tool", crafterId: "other", readyOnDay: 5 },
    };
    expect(startCraft(busy, "tool", "d1")).toBe(busy);

    const poor = colony(5, [dwarf()], { wood: 3, stone: 0 });
    expect(startCraft(poor, "tool", "d1")).toBe(poor);

    const hungry = colony(5, [dwarf({ hungry: true })], { wood: 9, stone: 9 });
    expect(startCraft(hungry, "tool", "d1")).toBe(hungry);

    const away = colony(5, [dwarf({ status: "expedition" })], {
      wood: 9,
      stone: 9,
    });
    expect(startCraft(away, "tool", "d1")).toBe(away);
  });

  it("finishes the item on the ready day and sends the crafter back to work", () => {
    const started = startCraft(
      colony(10, [dwarf()], { wood: 2, stone: 3 }),
      "weapon",
      "d1",
    );

    const day2 = advanceDay(started);
    expect(day2.forgeTask).not.toBeNull();
    expect(day2.resources.wood).toBe(0); // crafting, so no woodcutting
    expect(day2.resources.food).toBe(9); // but still eats

    const day3 = advanceDay(day2);
    expect(day3.resources.weapons).toBe(1);
    expect(day3.dwarves[0].status).toBe("working");
    expect(day3.forgeTask).toBeNull();
  });

  it("does not let a crafting dwarf travel", () => {
    expect(canTravel(dwarf({ status: "crafting" }))).toBe(false);
  });

  it("keeps forging when the crafter goes hungry", () => {
    const started = startCraft(
      colony(0, [dwarf()], { wood: 3, stone: 2 }),
      "tool",
      "d1",
    );
    const next = advanceDay(started);
    expect(next.dwarves[0].hungry).toBe(true);
    expect(next.resources.tools).toBe(1);
    expect(next.forgeTask).toBeNull();
  });

  it("sends only a free, fed dwarf on an expedition", () => {
    const sent = departExpedition(colony(5, [dwarf()]), "d1");
    expect(sent.dwarves[0].status).toBe("expedition");

    const hungry = colony(5, [dwarf({ hungry: true })]);
    expect(departExpedition(hungry, "d1")).toBe(hungry);

    const crafting = colony(5, [dwarf({ status: "crafting" })]);
    expect(departExpedition(crafting, "d1")).toBe(crafting);

    const away = colony(5, [dwarf({ status: "expedition" })]);
    expect(departExpedition(away, "d1")).toBe(away);
  });

  it("brings the dwarf home with the rewards and their tool", () => {
    const away = colony(5, [dwarf({ status: "expedition", hasTool: true })]);
    const home = endExpedition(away, "d1", { stone: 8, tools: 1 });
    expect(home.resources).toMatchObject({ stone: 8, tools: 1 });
    expect(home.dwarves[0]).toMatchObject({ status: "working", hasTool: true });
  });

  it("applies the rewards exactly once", () => {
    const away = colony(5, [dwarf({ status: "expedition" })]);
    const home = endExpedition(away, "d1", { stone: 8 });
    expect(endExpedition(home, "d1", { stone: 8 })).toBe(home);
    expect(home.resources.stone).toBe(8);
  });

  it("brings the dwarf home without rewards after a failure", () => {
    const away = colony(5, [dwarf({ status: "expedition", assignment: null })]);
    const home = endExpedition(away, "d1");
    expect(home.resources).toEqual(away.resources);
    expect(home.dwarves[0].status).toBe("idle");
  });

  it("ignores unknown or negative rewards", () => {
    const away = colony(5, [dwarf({ status: "expedition" })]);
    const rewards = { stone: -3, gold: 5 } as unknown as Partial<Resources>;
    expect(endExpedition(away, "d1", rewards).resources).toEqual(
      away.resources,
    );
  });

  it("accepts a valid save", () => {
    const save = validSave();
    expect(parseSave(save)).toEqual(save);
  });

  it("rejects corrupt or incompatible saves", () => {
    const save = validSave();
    const withDwarf = (changes: object) => ({
      ...save,
      colony: {
        ...save.colony,
        dwarves: [{ ...save.colony.dwarves[0], ...changes }],
      },
    });

    expect(parseSave(null)).toBeNull();
    expect(parseSave({ ...save, version: 99 })).toBeNull();
    expect(
      parseSave({
        ...save,
        colony: {
          ...save.colony,
          resources: { ...save.colony.resources, food: -1 },
        },
      }),
    ).toBeNull();
    expect(parseSave(withDwarf({ status: "sleeping" }))).toBeNull();
    expect(parseSave(withDwarf({ status: "crafting" }))).toBeNull(); // crafting without a forge task
    expect(parseSave({ ...save, activities: [{ id: 1 }] })).toBeNull();
  });

  it("brings a lost expedition home empty-handed after a reload", () => {
    const state = colony(5, [dwarf({ status: "expedition" })]);
    const { colony: resumed, notes } = resumeAfterReload(state);
    expect(resumed.dwarves[0].status).toBe("working");
    expect(resumed.resources).toEqual(state.resources);
    expect(notes).toHaveLength(1);
    expect(notes[0].tone).toBe("warning");
  });

  it("keeps a forge task running after a reload", () => {
    const state: ColonyState = {
      ...colony(5, [dwarf({ status: "crafting" })]),
      forgeTask: { recipeId: "tool", crafterId: "d1", readyOnDay: 3 },
    };
    const { colony: resumed, notes } = resumeAfterReload(state);
    expect(resumed).toBe(state);
    expect(notes[0].message).toContain("ready on day 3");
  });

  it("lets the kobold join once, and only after the Old Mine", () => {
    const start = colony(5, [dwarf()]);
    expect(welcomeNewcomer(start, "crystal-cave")).toBe(start);

    const joined = welcomeNewcomer(start, "old-mine");
    expect(joined.dwarves.map((resident) => resident.species)).toEqual([
      "dwarf",
      "kobold",
    ]);
    expect(welcomeNewcomer(joined, "old-mine")).toBe(joined);
  });

  it("uses the kobold's own production rates", () => {
    const kobold = dwarf({ species: "kobold", assignment: "mining" });
    expect(dailyOutput(kobold)).toEqual({ stone: 4 });
    expect(dailyOutput({ ...kobold, hasTool: true })).toEqual({ stone: 5 });
    expect(dailyOutput({ ...kobold, hungry: true })).toEqual({ stone: 3 });
  });

  it("lets a kobold forge a weapon in 1 day instead of 2", () => {
    const materials = { wood: 2, stone: 3 };
    const byKobold = startCraft(
      colony(5, [dwarf({ species: "kobold" })], materials),
      "weapon",
      "d1",
    );
    expect(byKobold.forgeTask?.readyOnDay).toBe(2);

    const byDwarf = startCraft(colony(5, [dwarf()], materials), "weapon", "d1");
    expect(byDwarf.forgeTask?.readyOnDay).toBe(3);
  });

  it("loads old saves without species as dwarves and rejects unknown species", () => {
    const save = validSave();
    const oldDwarf = { ...save.colony.dwarves[0] };
    delete oldDwarf.species;
    const oldSave = {
      ...save,
      colony: { ...save.colony, dwarves: [oldDwarf] },
    };
    expect(parseSave(oldSave)?.colony.dwarves[0].species).toBe("dwarf");

    const dragon = {
      ...save,
      colony: {
        ...save.colony,
        dwarves: [{ ...save.colony.dwarves[0], species: "dragon" }],
      },
    };
    expect(parseSave(dragon)).toBeNull();
  });

    it("shows the real job rate including species, tool and hunger", () => {
    const kobold = dwarf({ species: "kobold", assignment: null, status: "idle" });
    expect(jobRate(kobold, "mining")).toBe(4);
    expect(jobRate({ ...kobold, hasTool: true }, "mining")).toBe(5);
    expect(jobRate({ ...kobold, hasTool: true, hungry: true }, "mining")).toBe(4);
  });
});

import { describe, expect, it } from "vitest";
import {
  advanceDay,
  canTravel,
  craft,
  dailyOutput,
  equipTool,
  returnTool,
} from "./simulation";
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

  it("forges a weapon from 2 wood and 3 stone", () => {
    const next = craft(colony(0, [], { wood: 2, stone: 3 }), "weapon");
    expect(next.resources).toMatchObject({ wood: 0, stone: 0, weapons: 1 });
  });

  it("does not forge without enough materials", () => {
    const state = colony(0, [], { wood: 3, stone: 0 });
    expect(craft(state, "tool")).toBe(state);
  });
});

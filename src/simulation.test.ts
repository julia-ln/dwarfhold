import { describe, expect, it } from "vitest";
import { advanceDay, canTravel, dailyOutput } from "./simulation";
import type { ColonyState, Dwarf } from "./types";

const dwarf = (overrides: Partial<Dwarf> = {}): Dwarf => ({
  id: "d1",
  name: "Brom",
  title: "",
  icon: "",
  assignment: "woodcutting",
  status: "working",
  hungry: false,
  ...overrides,
});

const colony = (food: number, dwarves: Dwarf[]): ColonyState => ({
  day: 1,
  resources: { wood: 0, stone: 0, food, tools: 0 },
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
});

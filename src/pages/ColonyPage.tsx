import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { DwarfRoster } from "../components/DwarfRoster";
import {
  canTravel,
  dailyProduction,
  jobLabel,
  production,
  hasNewcomerJoined,
  DEFENSE_THRESHOLD,
  RAID_DESTINATION,
} from "../simulation";
import { useColony } from "../state/ColonyContext";
import type { ResourceKey } from "../types";

export function ColonyPage() {
  const {
    colony,
    activities,
    expeditionPending,
    assignDwarf,
    equip,
    unequip,
    sendExpedition,
  } = useColony();
  const [destination, setDestination] = useState("crystal-cave");
  const [expeditionDwarf, setExpeditionDwarf] = useState("dwarf-3");

  const produced = dailyProduction(colony.dwarves);
  const netFood = produced.food - colony.dwarves.length;
  const runsShort = colony.resources.food + netFood < 0;
  const hungryCount = colony.dwarves.filter((dwarf) => dwarf.hungry).length;
  const scout = colony.dwarves.find((dwarf) => dwarf.id === expeditionDwarf);
  const scoutCanTravel = scout !== undefined && canTravel(scout);
  const raid = colony.lastRaid;
  const weapons = colony.resources.weapons;

  return (
    <div className="dashboard">
      <DwarfRoster
        dwarves={colony.dwarves}
        toolsInStore={colony.resources.tools}
        onAssign={assignDwarf}
        onEquip={equip}
        onUnequip={unequip}
      />

      <section className="center-stack">
        <section className="panel production">
          <header>
            <div>
              <small>SHIFT LEDGER</small>
              <h2>Daily Production</h2>
            </div>
            <span>updates each day</span>
          </header>

          <div className="job-grid">
            {(["woodcutting", "mining", "farming"] as const).map((job) => (
              <article key={job}>
                <b>
                  {job === "woodcutting"
                    ? "🌲"
                    : job === "mining"
                      ? "⛏️"
                      : "🍄"}
                </b>
                <h3>{jobLabel(job)}</h3>
                <p>
                  {
                    colony.dwarves.filter(
                      (dwarf) =>
                        dwarf.assignment === job && dwarf.status === "working",
                    ).length
                  }{" "}
                  working
                </p>
                <strong>
                  +{produced[Object.keys(production[job])[0] as ResourceKey]} /
                  day
                </strong>
              </article>
            ))}
          </div>

          <div className="net-line">
            <span>NET FOOD AFTER MEALS</span>
            <strong className={netFood >= 0 ? "gain" : "loss"}>
              {netFood >= 0 ? "+" : ""}
              {netFood}
            </strong>
          </div>
          <p className="food-rule">
            Each resident eats 1 food per day, travellers included. If the
            rations run out, residents are fed in roster order. Unfed residents
            go hungry and produce 1 less until they are fed again.
            <br />
            An equipped tool adds 1 to its resident's daily output.
          </p>
          {hungryCount > 0 ? (
            <p className="food-rule short">
              Rations are empty. {hungryCount}{" "}
              {hungryCount === 1 ? "resident is" : "residents are"} hungry.
            </p>
          ) : (
            runsShort && (
              <p className="food-rule short">
                Rations will run short at the end of today.
              </p>
            )
          )}
        </section>
        {raid && (
          <section
            className={`panel raid-report ${raid.defended ? "defended" : "looted"}`}
          >
            <header>
              <div>
                <small>RAID REPORT</small>
                <h2>{raid.defended ? "Raid repelled" : "Stores looted"}</h2>
              </div>
              <span>day {raid.day}</span>
            </header>
            <p>
              {raid.defended
                ? `The hold's ${raid.weaponsLost} weapons drove the raiders off and broke in the fight.`
                : `Without ${DEFENSE_THRESHOLD} weapons, the raiders took ${raid.loot.wood} wood, ${raid.loot.stone} stone and ${raid.loot.food} food.`}
            </p>
          </section>
        )}
      </section>

      <aside className="side-stack">
        <section className="panel expedition">
          <header>
            <div>
              <small>BEYOND THE GATE</small>
              <h2>Expedition</h2>
            </div>
            <b>🗺️</b>
          </header>

          <label>
            Scout
            <select
              value={expeditionDwarf}
              onChange={(event) => setExpeditionDwarf(event.target.value)}
            >
              {colony.dwarves.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id}>
                  {dwarf.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Destination
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="crystal-cave">Crystal Cave</option>
              <option value="old-mine">The Old Mine</option>
              <option value="blocked-pass">Blocked Pass</option>
              <option value="howling-depths">Howling Depths ⚠</option>
            </select>
          </label>

          {!hasNewcomerJoined(colony) && (
            <p className="rumour">
              Rumour: something stirs in the deep tunnels of the Old Mine.
            </p>
          )}

          {destination === RAID_DESTINATION && (
            <p
              className={
                weapons >= DEFENSE_THRESHOLD
                  ? "raid-warning ready"
                  : "raid-warning"
              }
            >
              Raiders may follow the scout home. Defense needs{" "}
              {DEFENSE_THRESHOLD} weapons, which are used up (you have {weapons}
              ).
            </p>
          )}

          <button
            disabled={expeditionPending || !scoutCanTravel}
            onClick={() => sendExpedition(expeditionDwarf, destination)}
          >
            {expeditionPending ? "Beyond the gate…" : "Send expedition"}
          </button>
          {scout?.hungry && (
            <p className="travel-warning">
              {scout.name} is too hungry to travel. Feed them first.
            </p>
          )}
          {scout?.status === "crafting" && (
            <p className="travel-warning">{scout.name} is busy at the forge.</p>
          )}
          <p>
            The scout is away until the result arrives. An equipped tool travels
            with them. A failed or lost expedition returns the scout without
            rewards.
          </p>
        </section>

        <Chronicle activities={activities} />
      </aside>
    </div>
  );
}

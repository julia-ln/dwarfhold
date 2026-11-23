import {
  canEquipTool,
  canReturnTool,
  isFree,
  jobLabel,
  jobRate,
  speciesTraits,
} from "../simulation";
import type { Dwarf, JobType } from "../types";

const jobs: Exclude<JobType, null>[] = ["woodcutting", "mining", "farming"];

interface Props {
  dwarves: Dwarf[];
  toolsInStore: number;
  onAssign: (id: string, job: JobType) => void;
  onEquip: (id: string) => void;
  onUnequip: (id: string) => void;
}

export function DwarfRoster({
  dwarves,
  toolsInStore,
  onAssign,
  onEquip,
  onUnequip,
}: Props) {
  const presentDwarves = dwarves.filter(
    (dwarf) => dwarf.status !== "expedition",
  ).length;

  return (
    <section className="panel roster">
      <header>
        <div>
          <small>THE COMPANY</small>
          <h2>Holdfolk</h2>
        </div>
        <span>
          {presentDwarves} / {dwarves.length} present
        </span>
      </header>

      <div className="dwarf-list">
        {dwarves.map((dwarf) => {
          const isAway = dwarf.status === "expedition";
          const busyReason = isAway
            ? "Away on an expedition"
            : dwarf.status === "crafting"
              ? "Busy at the forge"
              : undefined;
          const specialty = dwarf.specialty
            ? `Skilled in ${jobLabel(dwarf.specialty)}`
            : "Generalist";

          return (
            <article
              className={`dwarf species-${dwarf.species}${isAway ? " away" : ""}`}
              key={dwarf.id}
            >
              <div className="portrait">
                {dwarf.icon}
                <i className={dwarf.status} />
              </div>

              <div className="dwarf-details">
                <h3>{dwarf.name}</h3>
                <p>
                  {speciesTraits[dwarf.species].label} · {dwarf.title} ·{" "}
                  {specialty}
                </p>

                <select
                  value={dwarf.assignment ?? ""}
                  disabled={!isFree(dwarf)}
                  title={busyReason}
                  onChange={(event) =>
                    onAssign(dwarf.id, (event.target.value || null) as JobType)
                  }
                >
                  <option value="">Unassigned</option>
                  {jobs.map((job) => (
                    <option value={job} key={job}>
                      {jobLabel(job)} (+{jobRate(dwarf, job)})
                    </option>
                  ))}
                </select>
                {dwarf.hasTool ? (
                  <button
                    className="tool-button"
                    disabled={!canReturnTool(dwarf)}
                    title={isAway ? "Away on an expedition" : undefined}
                    onClick={() => onUnequip(dwarf.id)}
                  >
                    Return tool
                  </button>
                ) : (
                  <button
                    className="tool-button"
                    disabled={!canEquipTool(dwarf, toolsInStore)}
                    title={
                      isAway
                        ? "Away on an expedition"
                        : toolsInStore === 0
                          ? "No tools in the stores"
                          : undefined
                    }
                    onClick={() => onEquip(dwarf.id)}
                  >
                    Equip tool
                  </button>
                )}
              </div>

              <div className="badges">
                <span className="status">{dwarf.status}</span>
                {dwarf.hungry && <span className="status hungry">Hungry</span>}
                {dwarf.hasTool && <span className="status tool">Tool</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

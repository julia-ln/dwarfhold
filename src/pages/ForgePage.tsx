import { Fragment, useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { resourceDetails } from "../components/ResourceBar";
import {
  canStartCraft,
  craftDays,
  recipes,
  type RecipeId,
} from "../simulation";
import { useColony } from "../state/ColonyContext";
import type { Dwarf, ResourceKey } from "../types";

const recipeIds: RecipeId[] = ["tool", "weapon"];

function unavailableReason(dwarf: Dwarf): string | null {
  if (dwarf.status === "expedition")
    return `${dwarf.name} is away on an expedition.`;
  if (dwarf.status === "crafting")
    return `${dwarf.name} is already at the forge.`;
  if (dwarf.hungry)
    return `${dwarf.name} is too hungry to forge. Feed them first.`;
  return null;
}

export function ForgePage() {
  const { colony, activities, forge } = useColony();
  const [crafterId, setCrafterId] = useState("dwarf-3");

  const task = colony.forgeTask;
  const taskCrafter = task
    ? colony.dwarves.find((dwarf) => dwarf.id === task.crafterId)
    : undefined;

  const crafter = colony.dwarves.find((dwarf) => dwarf.id === crafterId);
  const shownCrafter = taskCrafter ?? crafter;
  const fastSmiths = colony.dwarves.filter(
    (dwarf) => craftDays(dwarf, "weapon") < recipes.weapon.days,
  );
  const message = task
    ? `🔥 ${taskCrafter?.name} is forging a ${recipes[task.recipeId].name}, ready on day ${task.readyOnDay}.`
    : crafter
      ? unavailableReason(crafter)
      : null;

  return (
    <div className="forge-layout">
      <section className="panel forge">
        <div>
          <small>EMBER FORGE</small>
          <h2>Craft equipment</h2>
          <p>
            Tools add 1 to a working residents' output. Weapons are stored for the
            hold's defense. Materials are paid when forging starts.
          </p>
          {fastSmiths.map((dwarf) => {
            const days = craftDays(dwarf, "weapon");
            return (
              <p key={dwarf.id} className="forge-bonus">
                ⚡ {dwarf.name} forges weapons in {days}{" "}
                {days === 1 ? "day" : "days"}.
              </p>
            );
          })}
        </div>

        <label className="crafter">
          Crafter
          <select
            value={task ? task.crafterId : crafterId}
            disabled={task !== null}
            onChange={(event) => setCrafterId(event.target.value)}
          >
            {colony.dwarves.map((dwarf) => (
              <option key={dwarf.id} value={dwarf.id}>
                {dwarf.name}
              </option>
            ))}
          </select>
        </label>
        <p className={task ? "forge-status" : "forge-status warning"}>
          {message}
        </p>

        <div className="recipes">
          {recipeIds.map((id) => {
            const recipe = recipes[id];
            const days = shownCrafter
              ? craftDays(shownCrafter, id)
              : recipe.days;

            return (
              <div className="recipe" key={id}>
                {Object.entries(recipe.cost).map(
                  ([resource, amount], index) => (
                    <Fragment key={resource}>
                      {index > 0 && <i>+</i>}
                      <span>
                        {amount} {resourceDetails[resource as ResourceKey][0]}
                      </span>
                    </Fragment>
                  ),
                )}
                <i>→</i>
                <span>1 {resourceDetails[recipe.output][0]}</span>
                <small className="recipe-days">
                  {days} {days === 1 ? "day" : "days"}
                </small>
                <button
                  disabled={!canStartCraft(colony, id, crafterId)}
                  onClick={() => forge(id, crafterId)}
                >
                  Forge {recipe.name}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <Chronicle activities={activities} />
    </div>
  );
}

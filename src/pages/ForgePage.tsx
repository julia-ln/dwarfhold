import { Fragment } from "react";
import { Chronicle } from "../components/Chronicle";
import { resourceDetails } from "../components/ResourceBar";
import { canAfford, recipes, type RecipeId } from "../simulation";
import { useColony } from "../state/ColonyContext";
import type { ResourceKey } from "../types";

const recipeIds: RecipeId[] = ["tool", "weapon"];

export function ForgePage() {
  const { colony, activities, forge } = useColony();

  return (
    <div className="forge-layout">
      <section className="panel forge">
        <div>
          <small>EMBER FORGE</small>
          <h2>Craft equipment</h2>
          <p>
            Tools add 1 to a working dwarf's output. Weapons are stored for the
            hold's defense.
          </p>
        </div>

        <div className="recipes">
          {recipeIds.map((id) => {
            const recipe = recipes[id];

            return (
              <div className="recipe" key={id}>
                {Object.entries(recipe.cost).map(([resource, amount], index) => (
                  <Fragment key={resource}>
                    {index > 0 && <i>+</i>}
                    <span>
                      {amount} {resourceDetails[resource as ResourceKey][0]}
                    </span>
                  </Fragment>
                ))}
                <i>→</i>
                <span>1 {resourceDetails[recipe.output][0]}</span>
                <button
                  disabled={!canAfford(colony.resources, recipe.cost)}
                  onClick={() => forge(id)}
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
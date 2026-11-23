import type { Resources } from "../types";

export const resourceDetails = {
  wood: ["🪵", "Timber"],
  stone: ["🪨", "Stone"],
  food: ["🍄", "Rations"],
  tools: ["⚒️", "Tools"],
  weapons: ["🗡️", "Weapons"],
} as const;

export function ResourceBar({
  resources,
  equippedTools,
}: {
  resources: Resources;
  equippedTools: number;
}) {
  return (
    <section className="resource-bar">
      {Object.entries(resources).map(([key, value]) => {
        const [icon, label] = resourceDetails[key as keyof Resources];

        return (
          <article key={key}>
            <span>{icon}</span>
            <div>
              <small>
                {label}
                {key === "tools" && equippedTools > 0
                  ? ` · ${equippedTools} equipped`
                  : ""}
              </small>
              <strong>{value}</strong>
            </div>
          </article>
        );
      })}
    </section>
  );
}

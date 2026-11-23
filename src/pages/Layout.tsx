import { NavLink, Outlet } from "react-router";
import { ResourceBar } from "../components/ResourceBar";
import { useColony } from "../state/ColonyContext";

export function Layout() {
  const { colony, paused, togglePaused, resetGame } = useColony();
  const equippedTools = colony.dwarves.filter((dwarf) => dwarf.hasTool).length;

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <b>⛏</b>
          <div>
            <small>THE DEEP REALMS OF</small>
            <h1>
              Dwarf<span>hold</span>
            </h1>
          </div>
        </div>
        <div className="hold-title">
          <small>COLONY</small>
          <strong>STONEHOME</strong>
          <span>Founded beneath Emberpeak</span>
        </div>
        <div className="day">
          <small>DEEP DAY</small>
          <strong>{colony.day}</strong>
          <button onClick={togglePaused}>
            {paused ? "Wake the hold" : "Pause"}
          </button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Colony navigation">
        <NavLink to="/" end>
          Colony
        </NavLink>
        <NavLink to="/forge">Forge</NavLink>
      </nav>

      <ResourceBar resources={colony.resources} equippedTools={equippedTools} />
      <Outlet />

      <footer>
        <span>{colony.forgeTask ? "🔥 Forge: burning" : "Forge: cold"}</span>
        <span>Next deep day in ~8 seconds</span>
        <span>{paused ? "The hold is resting" : "⚙ Simulation active"}</span>
        <button
          className="reset-button"
          onClick={() => {
            if (
              window.confirm(
                "Start a new settlement? All progress will be lost.",
              )
            ) {
              resetGame();
            }
          }}
        >
          New settlement
        </button>
      </footer>
    </main>
  );
}

import { useState } from "react";
import type { ReactElement } from "react";
import { isSupabaseConfigured } from "./lib/config";
import { HostView } from "./components/HostView";
import { PlayerView } from "./components/PlayerView";

type AppMode = "player" | "host";

/** Root application shell with role switching for host and player use. */
export function App(): ReactElement {
  const [mode, setMode] = useState<AppMode>("player");
  const hasSupabaseConfig = isSupabaseConfigured();

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-lockup" aria-label="Where in the World, an Imminently experience">
          <span className="product-mark" aria-hidden="true">
            <span className="product-mark-latitude" />
            <span className="product-mark-longitude" />
          </span>
          <div>
            <p className="brand-name">Where in the World</p>
            <p className="brand-credit">An Imminently experience</p>
          </div>
        </div>
        <nav className="mode-switch" aria-label="Application mode">
          <button
            className={mode === "player" ? "active" : ""}
            onClick={() => setMode("player")}
          >
            Player
          </button>
          <button
            className={mode === "host" ? "active" : ""}
            onClick={() => setMode("host")}
          >
            Host
          </button>
        </nav>
      </header>

      {!hasSupabaseConfig ? (
        <div className="config-warning" role="alert">
          Add Supabase values from <code>.env.example</code> to <code>.env.local</code> before using live games.
        </div>
      ) : null}

      {mode === "host" ? <HostView /> : <PlayerView />}

      <footer className="app-footer">
        <p>Made for curious teams everywhere.</p>
        <p className="footer-brand">Imminently <span>We fuel ideas</span></p>
      </footer>
    </div>
  );
}

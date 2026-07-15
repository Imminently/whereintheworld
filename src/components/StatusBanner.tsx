import type { ReactElement } from "react";

interface StatusBannerProps {
  message: string | null;
  tone?: "info" | "error" | "success";
}

/** Displays a compact status message for async host and player actions. */
export function StatusBanner({
  message,
  tone = "info",
}: StatusBannerProps): ReactElement | null {
  if (message === null) {
    return null;
  }

  return (
    <div className={`status status-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}

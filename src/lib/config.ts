import { z } from "zod";

const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const clientConfigSchema = z.object({
  supabaseUrl: z.string().url().optional(),
  supabasePublishableKey: z.string().min(1).optional(),
  mapStyleUrl: z.string().url(),
});

export interface ClientConfig {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  mapStyleUrl: string;
}

const parsedConfig = clientConfigSchema.parse({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  mapStyleUrl: import.meta.env.VITE_MAP_STYLE_URL ?? DEFAULT_MAP_STYLE_URL,
});

export const clientConfig: ClientConfig = parsedConfig;

/** Returns true when the browser has enough Supabase configuration to call the backend. */
export function isSupabaseConfigured(config: ClientConfig = clientConfig): boolean {
  return (
    config.supabaseUrl !== undefined &&
    config.supabasePublishableKey !== undefined
  );
}

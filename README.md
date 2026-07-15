# Where in the World

A live team game where players guess the location behind each teammate photo. The app uses React/Vite for the web UI, Supabase for auth/data/storage/realtime, and MapLibre with OpenFreeMap tiles for the map.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project.

3. Configure Auth:

   - Disable public signups.
   - Create the host account manually in the Supabase Dashboard under Authentication > Users.
   - Use that host account's email/password in the Host tab.

4. Apply the migrations in `supabase/migrations` using the instructions in
   [Updating Supabase](#updating-supabase).

5. Deploy the Edge Functions in `supabase/functions` using the instructions in
   [Updating Supabase](#updating-supabase).

6. Copy `.env.example` to `.env.local` and fill in:

   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
   ```

7. Run the app:

   ```bash
   npm run dev
   ```

## Publishing the Web App with GitHub Pages

The React/Vite web app is deployed separately from the Supabase backend. This
repository includes `.github/workflows/deploy-pages.yml`, which builds and
publishes the web app whenever `main` is pushed.

### One-time GitHub setup

1. Create a GitHub repository and push this repository's `main` branch to it.
2. In the GitHub repository, open **Settings > Secrets and variables > Actions >
   Variables** and add:

   - `VITE_SUPABASE_URL`: the hosted Supabase project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the hosted project's publishable key.

   These values are public browser configuration. Never add a Supabase secret or
   service-role key to the web build.
3. Open **Settings > Pages** and set **Source** to **GitHub Actions**.
4. Push `main`, or run **Deploy web app to GitHub Pages** manually from the
   repository's **Actions** tab.

The workflow obtains the correct Pages base path from GitHub, so project sites such
as `https://<username>.github.io/<repository>/` work without hardcoding the
repository name. After the first deployment, set its URL as the Supabase Auth
**Site URL** under **Authentication > URL Configuration**.

Future frontend changes are published by pushing `main`. Database migrations and
Edge Functions still use the separate Supabase deployment commands below.

## Updating Supabase

Run these commands from the repository root. You need the Supabase project reference and permission to deploy to the project.

### One-time CLI setup

Authenticate the CLI, then link this checkout to the hosted project:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

The project reference is the subdomain in `https://<project-ref>.supabase.co` and is also available in the Supabase Dashboard project settings. Linking may prompt for the database password.

### Apply database migrations

Preview the pending migrations before applying them:

```bash
npx supabase db push --dry-run
npx supabase db push
```

Apply migrations before deploying functions that depend on them. Replay requires both
`20260714000000_reset_game_for_replay.sql` and
`20260714001000_rotate_code_and_kick_players_on_replay.sql` before the updated
`host-command` function is used.

### Deploy Edge Functions

Deploy every function in `supabase/functions`:

```bash
npx supabase functions deploy
```

To deploy only the function changed by the replay feature:

```bash
npx supabase functions deploy host-command
```

Run deployment commands from the repository root so the CLI uses `supabase/config.toml`. That file intentionally configures JWT verification per function; do not add `--no-verify-jwt` to the blanket deployment command.

Supabase provides the hosted functions with their standard project environment variables. Never put a service-role or secret key in `.env.local`, frontend code, or this README.

### Verify the update

Confirm that migration history and deployed functions are visible:

```bash
npx supabase migration list
npx supabase functions list
```

The local and remote columns from `supabase migration list` should match. If a migration appears only in the local column, it has not been applied to the hosted database yet; run `npx supabase db push` before testing dependent functions.

Then sign in through the Host tab and smoke-test the changed flow. For replay updates,
finish a game, select **Play again**, and confirm that the rounds, images, and locations
remain; the join code changes; the player count returns to zero; and every player must
claim their name again.

## Game Flow

- Host signs in with the manually created Supabase account.
- Host creates a game with a four-digit code.
- Host uploads teammate photos and pins the correct locations.
- Players enter the code, claim their roster name, and wait in the lobby. Players do not create Supabase Auth accounts.
- Host manually starts each round, reveals the answer, then starts the next round.
- The subject of the photo is skipped for their own round.
- Lowest cumulative distance wins. Ties are co-winners.
- After a game finishes, the host can play again with the same rounds, images, locations, and roster. Replay clears players, guesses, reveals, and scores, rotates the join code, then opens a fresh lobby.

## Security Model

- Host access requires a permanent Supabase user, not an anonymous session.
- Player access uses an opaque game session token returned by `join-game`; only the SHA-256 hash is stored in `participants`.
- Player lookup and join Edge Functions are public URLs, but they only work while the game is in `lobby`, require the four-digit code, and are rate-limited per client IP.
- Player state, photo URL, and guess submission require the opaque player session token.
- Correct answers live in `round_answers`, which players cannot read through RLS.
- Photos live in a private `game-photos` bucket.
- Players receive short-lived signed photo URLs only for visible rounds.
- Guess submission and reveal scoring run through Edge Functions.
- The four-digit code is casual access control. It is hashed at rest, but it is not intended as strong authentication.

## Verification

```bash
npm test
npm run lint
npm run build
```

The production build may warn about a large bundle because MapLibre is included in the main app bundle. That is acceptable for v1; code-splitting the map component is a later optimization.

## Troubleshooting

- `Could not find the table 'public.games' in the schema cache`: apply all SQL files in `supabase/migrations` to the Supabase project backing `.env.local`, in filename order. For a hosted project, either run `supabase db push` after linking the project, or paste the migration SQL into the Supabase SQL Editor.
- Host command appears to do requests but the phase does not change: redeploy `host-command` and apply the latest migrations. The app uses public Realtime game-event channels with non-sensitive payloads; answers and photos are still protected server-side.
- `Sign in with a host account before managing games`: sign out, then sign in on the Host tab with the manually created Supabase user. Anonymous player sessions cannot manage games.
- `Signups not allowed for this instance`: deploy the latest player-session-token changes. Players should no longer call Supabase anonymous sign-in.

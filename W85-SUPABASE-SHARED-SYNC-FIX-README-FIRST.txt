Adventure Builder Website W85 - Supabase Shared Sync Fix
9 September 2026

- Uses ADVENTURE_BUILDER_CONFIG, the same Supabase config as website login.
- Prefers the existing authenticated Adventure Builder Supabase client.
- Re-runs shared plan sync when auth becomes available.
- Trip Planner uses the shared save path and reports cloud-save errors.
- Diagnostics now uses the production auth/config stack.
- Does not delete or overwrite the local Lake District Trip.

Files: js/shared-adventures-v1.js, js/trip-planner-v27.js, js/sync-diagnostics-v1.js, sync-diagnostics.html.

After deploy: stay signed in, open sync-diagnostics.html, Run diagnostics, then send the result screenshot.

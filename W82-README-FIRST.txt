ADVENTURE BUILDER WEBSITE W82 — SHARED ADVENTURES FOUNDATION
============================================================

PURPOSE
Make the website and app use the same saved Adventure Builder plans instead of behaving like separate products.

WHAT CHANGED
- New js/shared-adventures-v1.js shared plan/sync layer.
- My Adventure World now refreshes when signed-in plans are merged from Supabase.
- Trip Planner emits the shared-plan update event when local plans change.
- adventures.html and trip-planner.html load the shared foundation.

DATA
- Reuses the existing public.adventure_plans Supabase table already used by the website/app Trip Planner.
- No new SQL migration is required for this build.
- Local fallback remains adventure-builder-plans-v1 when signed out/offline.

SAFE APPLICATION
Copy/overlay these files into the current CLEAN website repo. Do not replace the whole repo with an old backup.

TESTS
- node --check passed for all changed JavaScript files.
- No Git conflict markers in changed source files.
- ZIP integrity checked after packaging.

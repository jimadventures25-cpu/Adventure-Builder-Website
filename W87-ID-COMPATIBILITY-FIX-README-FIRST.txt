Adventure Builder Website W87 — Supabase ID Compatibility Fix
9 September 2026

Purpose
- Fixes the cloud upload error: null value in column "id" of relation "adventure_plans" violates not-null constraint.
- Sends the existing Adventure Builder plan UUID as both id and plan_id on inserts/upserts.
- Keeps plan_id as the shared website/app conflict key.
- Does not delete or recreate local plans.

Expected test
1. Deploy W87.
2. Open My Adventure World while signed in.
3. Wait a few seconds.
4. Run sync diagnostics.
5. Expect Cloud adventure_plans rows = 1 and Cloud Lake District matches = 1.

Adventure Builder Website W86 - Shared Sync Upload Fix
9 September 2026

Purpose
- Uses the existing unique plan_id key for Supabase upserts.
- Allows a signed-in website plan to upload to public.adventure_plans after the cloud read.
- Preserves local plans before any cloud write.
- Does not delete plans.

Install
Copy this overlay into the WEBSITE repository root, replacing js/shared-adventures-v1.js.

Test
1. Deploy/push website.
2. Open My Adventure World while signed in.
3. Wait a moment, then open sync-diagnostics.html and Run diagnostics.
4. Expect Cloud adventure_plans rows = 1 and Cloud Lake District matches = 1.

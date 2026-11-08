# ASUU FUTA Cooperatives Stock

Static demonstration with 25 sample products. Changes are stored in the current browser. Staff and EXCO authentication and shared transaction storage are planned for operational use.

## Staff and EXCO pilot

Open **Staff / EXCO sign-in** from the demo. The pilot requires a dedicated Supabase project, with email/password enabled and public sign-up disabled. Apply the migration under `supabase/migrations` and set the project URL and **publishable key** in `coop-config.js`. Use the dashboard to provision individual Auth users and assign each user's UUID to `coop_private.accounts` with role `staff` or `exco` and their audit display name. Load approved products and quantities separately. The browser demo and its saved records are separate from the shared workspace.

Staff can look up current stock, record paid sales and receive stock, and see their own activity. EXCO can view all recorded activity and export reports with the recorded-by names. Credit sales, payment collection, returns and stock adjustments are demo-only in this version. No sample products or transactions are inserted into the shared database by the migration.

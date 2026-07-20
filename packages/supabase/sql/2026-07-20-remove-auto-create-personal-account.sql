-- Stop auto-creating a personal account for every new user.
-- Personal accounts will be created explicitly (e.g. after purchase).
-- Org-invited users can exist without a personal account.

DROP TRIGGER IF EXISTS trg_create_personal_account_for_user ON public.users;
DROP FUNCTION IF EXISTS public.create_personal_account_for_user();

-- These triggers blocked manual personal account creation/membership,
-- which is required for the purchase flow.
DROP TRIGGER IF EXISTS trg_prevent_personal_account_changes ON public.accounts;
DROP FUNCTION IF EXISTS public.prevent_personal_account_changes();

DROP TRIGGER IF EXISTS trg_prevent_personal_account_user_changes ON public.account_users;
DROP FUNCTION IF EXISTS public.prevent_personal_account_user_changes();

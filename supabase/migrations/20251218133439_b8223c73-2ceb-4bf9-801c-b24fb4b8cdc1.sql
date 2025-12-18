-- Add team attribution to generations
ALTER TABLE public.generation_history
ADD COLUMN IF NOT EXISTS team_id uuid;

-- Link to teams table (safe; does not reference auth schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'generation_history_team_id_fkey'
  ) THEN
    ALTER TABLE public.generation_history
    ADD CONSTRAINT generation_history_team_id_fkey
    FOREIGN KEY (team_id)
    REFERENCES public.teams(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_generation_history_team_id
ON public.generation_history(team_id);

-- Backfill best-effort for existing rows (first approved team membership of the creator)
WITH first_team AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    team_id
  FROM public.team_members
  WHERE status = 'approved'
  ORDER BY user_id, created_at ASC
)
UPDATE public.generation_history gh
SET team_id = ft.team_id
FROM first_team ft
WHERE gh.team_id IS NULL
  AND gh.user_id IS NOT NULL
  AND ft.user_id = gh.user_id;
-- 003_fix_agent_news_rls.sql

-- 1) Asegura RLS (por si acaso)
ALTER TABLE agent_news ENABLE ROW LEVEL SECURITY;

-- 2) Borra políticas viejas (si existen)
DROP POLICY IF EXISTS "Agents and admins can view news" ON agent_news;
DROP POLICY IF EXISTS "Admins can manage news" ON agent_news;

-- 3) SELECT: agentes y admins pueden ver
CREATE POLICY "Agents and admins can view news"
ON agent_news
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('agent', 'admin')
  )
);

-- 4) INSERT: solo admin publica
CREATE POLICY "Admins can insert news"
ON agent_news
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- 5) UPDATE: solo admin edita/pinea
CREATE POLICY "Admins can update news"
ON agent_news
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- 6) DELETE: solo admin elimina
CREATE POLICY "Admins can delete news"
ON agent_news
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- 7) (Opcional pero recomendado) Restringe category a valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_news_category_check'
  ) THEN
    ALTER TABLE agent_news
      ADD CONSTRAINT agent_news_category_check
      CHECK (category IS NULL OR category IN ('update', 'promo', 'alert'));
  END IF;
END $$;
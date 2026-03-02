-- Fix: Las políticas RLS de admin en agent_requests usaban auth.jwt() ->> 'role'
-- que siempre devuelve NULL porque el rol se almacena en la tabla profiles,
-- no como claim dentro del JWT. El patrón correcto (igual al resto del proyecto)
-- es verificar el rol mediante un EXISTS contra la tabla profiles.

DROP POLICY IF EXISTS "Admins can view agent requests" ON public.agent_requests;
DROP POLICY IF EXISTS "Admins can update agent requests" ON public.agent_requests;

CREATE POLICY "Admins can view agent requests"
  ON public.agent_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.role)::text = 'admin'::text
    )
  );

CREATE POLICY "Admins can update agent requests"
  ON public.agent_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.role)::text = 'admin'::text
    )
  );

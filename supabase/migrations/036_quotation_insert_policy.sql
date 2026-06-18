-- ============================================================================
-- 036_quotation_insert_policy.sql  (already applied to production)
-- Phase 10 — quotation_requests had INSERT "public WITH CHECK(true)", letting
-- anyone insert via the REST API with the anon key (spam). No app code creates
-- quotations, so restrict INSERT to authenticated users creating their own row.
-- A future guest-quote feature should use a rate-limited server route.
-- ============================================================================
drop policy if exists "Anyone can create quotation" on public.quotation_requests;
create policy "Users create own quotation" on public.quotation_requests
  for insert to authenticated
  with check (auth.uid() = user_id);

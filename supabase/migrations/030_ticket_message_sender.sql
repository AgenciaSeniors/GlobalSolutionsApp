-- ============================================================================
-- 030_ticket_message_sender.sql  (already applied to production)
-- Prevent ticket-message sender spoofing. The previous INSERT policies on
-- agent_ticket_messages validated the ticket relationship but not that
-- sender_id = auth.uid(), so a participant could forge messages as another
-- user. One policy now requires being a participant (or admin) AND sending as
-- oneself. Service role bypasses RLS for system inserts.
-- ============================================================================
drop policy if exists "Send messages to own tickets" on public.agent_ticket_messages;
drop policy if exists "Ticket participants send messages" on public.agent_ticket_messages;

create policy "Participants send messages as themselves" on public.agent_ticket_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.agent_tickets t
      where t.id = agent_ticket_messages.ticket_id
        and (t.created_by = auth.uid()
             or t.assigned_to = auth.uid()
             or (select public.auth_uid_is_admin()))
    )
  );

-- =============================================================================
-- Admin safety guards
-- * The store must always keep at least one owner (nobody can lock the
--   business out of its own dashboard by removing or demoting the last owner).
-- =============================================================================

create or replace function public.guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    if not exists (
      select 1 from public.staff_members
      where role = 'owner' and user_id <> old.user_id
    ) then
      raise exception 'LAST_OWNER' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.guard_last_owner() from public, anon, authenticated, service_role;

create trigger staff_members_keep_owner
  before update or delete on public.staff_members
  for each row execute function public.guard_last_owner();

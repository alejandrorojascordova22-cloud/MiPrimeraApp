create or replace function public.desactivar_aviso_admin(p_aviso_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.avisos
     set activo = false
   where id = p_aviso_id;

  return found;
end;
$$;

grant execute on function public.desactivar_aviso_admin(bigint) to authenticated;
grant execute on function public.desactivar_aviso_admin(bigint) to service_role;

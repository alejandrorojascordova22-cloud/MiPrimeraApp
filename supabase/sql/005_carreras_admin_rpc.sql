create or replace function public.crear_carrera_admin(p_nombre text, p_tipo text default 'General')
returns table (id bigint, nombre text, tipo text, creado_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.carreras (nombre, tipo)
  values (p_nombre, p_tipo)
  returning id, nombre, tipo, creado_en;
end;
$$;

grant execute on function public.crear_carrera_admin(text, text) to authenticated;
grant execute on function public.crear_carrera_admin(text, text) to service_role;

create or replace function public.actualizar_carrera_admin(p_carrera_id bigint, p_nombre text, p_tipo text default 'General')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.carreras
     set nombre = p_nombre,
         tipo = p_tipo
   where id = p_carrera_id;

  return found;
end;
$$;

grant execute on function public.actualizar_carrera_admin(bigint, text, text) to authenticated;
grant execute on function public.actualizar_carrera_admin(bigint, text, text) to service_role;

create or replace function public.eliminar_carrera_admin(p_carrera_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.carreras
   where id = p_carrera_id;

  return found;
end;
$$;

grant execute on function public.eliminar_carrera_admin(bigint) to authenticated;
grant execute on function public.eliminar_carrera_admin(bigint) to service_role;

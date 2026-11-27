-- 0073_meetings.sql
-- Reuniones en la Agenda. Una reunión es un bloqueo con kind = 'reunion': cierra el hueco para
-- reservas (get_available_slots ya respeta los bloqueos) y nunca cancela citas.
--   * Todo el equipo: una fila con scope = 'business'.
--   * Algunas personas: una fila por profesional, todas con el mismo meeting_id.
-- El título va en `reason`. Permisos: los de blocks (cualquier miembro del negocio).

alter table public.blocks
  add column if not exists kind text not null default 'bloqueo',
  add column if not exists meeting_id uuid;

alter table public.blocks
  add constraint blocks_kind_check check (kind in ('bloqueo', 'reunion')),
  add constraint blocks_meeting_check check (
    kind <> 'reunion' or (meeting_id is not null and cancels_affected is not true and nullif(btrim(reason), '') is not null)
  );

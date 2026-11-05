// Genera supabase/demo/setup_cheesecake_ando.sql leyendo la carta real de la web
// (Webs/Cheesecake.ando-web/src/data/menu.ts), para no copiar sabores a mano.
//
//   node supabase/demo/gen_cheesecake_ando.mjs "<ruta a menu.ts>" > supabase/demo/setup_cheesecake_ando.sql
//
// El SQL es idempotente (on conflict do nothing / do update): se puede re-ejecutar tras cambiar la
// carta para añadir sabores nuevos. NO crea el usuario de staff: se añade luego desde
// Admin → negocio → Usuarios (la contraseña la pone una persona, no este script).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const menuPath = process.argv[2];
if (!menuPath) { console.error("Uso: node gen_cheesecake_ando.mjs <ruta a menu.ts>"); process.exit(1); }

const js = esbuild.transformSync(readFileSync(menuPath, "utf8"), { loader: "ts", format: "esm" }).code;
const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const { tiers, sizes } = mod;

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const LABELS = { basicas: "Básicas", clasicas: "Clásicas", premium: "Premium", especiales: "Tartas especiales" };
const SIZE_LABEL = {
  mediana: `Mediana (${sizes.medium})`,
  grande: `Grande (${sizes.large})`,
};

const out = [];
out.push(`-- Generado por gen_cheesecake_ando.mjs desde menu.ts. Idempotente.
-- Valores de EJEMPLO a confirmar con el dueño: default_capacity (recogidas simultáneas por franja) = 2.
-- Antelación mínima, capacidad diaria y política de cancelación quedan VACÍAS a propósito
-- (las decide el negocio en Configuración → Reglas de los encargos online).
begin;

insert into public.businesses (name, slug, type, primary_color, timezone, order_mode, default_capacity, slot_interval_min)
values ('cheesecake.ando', 'cheesecake-ando', 'citas', '#A5565F', 'Europe/Madrid', true, 2, 15)
on conflict (slug) do nothing;

do $$
declare bid uuid := (select id from public.businesses where slug = 'cheesecake-ando');
begin
  -- Horario de invierno: L cerrado; M-V 10:00-13:30 y 17:00-21:00; S-D 10:00-14:30.
  if not exists (select 1 from public.business_hours where business_id = bid) then
    insert into public.business_hours (business_id, weekday, open_time, close_time) values
      (bid, 2, '10:00', '13:30'), (bid, 2, '17:00', '21:00'),
      (bid, 3, '10:00', '13:30'), (bid, 3, '17:00', '21:00'),
      (bid, 4, '10:00', '13:30'), (bid, 4, '17:00', '21:00'),
      (bid, 5, '10:00', '13:30'), (bid, 5, '17:00', '21:00'),
      (bid, 6, '10:00', '14:30'),
      (bid, 0, '10:00', '14:30');
  end if;

  insert into public.order_settings (business_id, require_confirmation) values (bid, true)
  on conflict (business_id) do nothing;
`);

tiers.forEach((t, i) => {
  out.push(`  insert into public.service_option_groups (business_id, group_key, label, sort_order)
  values (bid, ${q(t.id)}, ${q(LABELS[t.id] ?? t.tag ?? t.id)}, ${i})
  on conflict (business_id, group_key) do update set sort_order = excluded.sort_order;
`);
});

// Servicios: uno por nivel × tamaño (precio de la carta).
let so = 0;
for (const t of tiers) {
  for (const [sizeKey, price] of [["mediana", t.medium], ["grande", t.large]]) {
    const name = `${sizeKey === "mediana" ? "Mediana" : "Grande"} · ${LABELS[t.id] ?? t.id}`;
    out.push(`  insert into public.services (business_id, name, duration_min, buffer_min, price, sort_order, size_key, size_label, option_group)
  select bid, ${q(name)}, 15, 0, ${price}, ${so++}, ${q(sizeKey)}, ${q(SIZE_LABEL[sizeKey])}, ${q(t.id)}
  where not exists (select 1 from public.services s where s.business_id = bid and s.size_key = ${q(sizeKey)} and s.option_group = ${q(t.id)});
`);
  }
}

// Sabores.
for (const t of tiers) {
  t.items.forEach((name, i) => {
    out.push(`  insert into public.service_options (business_id, option_group, name, sort_order) values (bid, ${q(t.id)}, ${q(name)}, ${i}) on conflict (business_id, option_group, name) do nothing;`);
  });
}

out.push(`end $$;

commit;
`);
process.stdout.write(out.join("\n"));

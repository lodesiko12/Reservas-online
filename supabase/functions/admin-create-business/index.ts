// admin-create-business — Alta de un negocio + su usuario de staff.
// Solo super-admin (verify_jwt = true; además se comprueba is_super_admin).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";

type Body = {
  name?: string;
  slug?: string;
  type?: "citas" | "restaurante" | "psicologo" | "autonomo" | "asesoria" | "agencia";
  timezone?: string;
  primary_color?: string;
  staff_email?: string;
  staff_password?: string;
  staff_name?: string;
  seed_default_hours?: boolean;
};

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // 1) Verificar que quien llama es super-admin.
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData } = await admin.auth.getUser(jwt);
  const uid = userData.user?.id;
  if (!uid) return json({ error: "No autenticado" }, 401);
  const { data: prof } = await admin.from("profiles").select("is_super_admin").eq("id", uid).single();
  if (!prof?.is_super_admin) return json({ error: "Solo el super-admin puede crear negocios" }, 403);
  if (!(await rateLimitHit(admin, `admin-create-business:user:${uid}`, 10, 3600))) {
    return tooManyRequests(3600);
  }

  // 2) Validar entrada.
  const b: Body = await req.json().catch(() => ({}));
  const name = b.name?.trim();
  const slug = b.slug?.trim().toLowerCase();
  const type = b.type;
  if (!name || !slug || !type) return json({ error: "Faltan name, slug o type." }, 400);
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: "El slug solo admite minúsculas, números y guiones." }, 400);
  if (!b.staff_email || !b.staff_password) return json({ error: "Faltan credenciales del staff." }, 400);
  if (b.staff_password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);

  // 3) Crear el negocio.
  const { data: biz, error: bizErr } = await admin
    .from("businesses")
    .insert({
      name, slug, type,
      timezone: b.timezone || "Europe/Madrid",
      primary_color: b.primary_color || "#4f46e5",
    })
    .select()
    .single();
  if (bizErr) {
    const msg = bizErr.code === "23505" ? "Ya existe un negocio con ese slug." : bizErr.message;
    return json({ error: msg }, 409);
  }

  // 4) Crear el usuario de staff (o vincular si ya existe).
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: b.staff_email.trim(),
    password: b.staff_password,
    email_confirm: true,
    user_metadata: { full_name: b.staff_name || name },
  });

  let staffId = created?.user?.id;
  if (userErr || !staffId) {
    // Si el email ya existe, lo localizamos y le fijamos la contraseña indicada
    // (antes se vinculaba sin actualizarla, dejando activa la contraseña anterior).
    const { data: list } = await admin.auth.admin.listUsers();
    staffId = list?.users.find((u) => u.email === b.staff_email!.trim())?.id;
    if (!staffId) {
      await admin.from("businesses").delete().eq("id", biz.id); // rollback
      return json({ error: `No se pudo crear el usuario: ${userErr?.message}` }, 400);
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(staffId, {
      password: b.staff_password,
      email_confirm: true,
    });
    if (updErr) {
      await admin.from("businesses").delete().eq("id", biz.id); // rollback
      return json({ error: `El email ya existía y no se pudo actualizar su contraseña: ${updErr.message}` }, 400);
    }
  }

  await admin.from("business_users").insert({ business_id: biz.id, user_id: staffId, role: "owner" });

  // 5) Horario por defecto (L-V 09:00-18:00) opcional.
  if (b.seed_default_hours !== false) {
    const rows = [1, 2, 3, 4, 5].map((wd) => ({
      business_id: biz.id, weekday: wd, open_time: "09:00", close_time: "18:00",
    }));
    await admin.from("business_hours").insert(rows);
  }

  // 6) Etapas por defecto del pipeline + mapeo del flujo conectado, solo para autónomos.
  if (type === "autonomo") {
    const stageDefs = [
      { name: "Sin contactar", color: "#94a3b8" },
      { name: "Contactado", color: "#38bdf8" },
      { name: "Presupuestado", color: "#a78bfa" },
      { name: "Confirmado", color: "#fbbf24" },
      { name: "En curso", color: "#fb923c" },
      { name: "Pagado", color: "#34d399" },
    ];
    const { data: stages } = await admin
      .from("crm_pipeline_stages")
      .insert(stageDefs.map((s, i) => ({ business_id: biz.id, name: s.name, color: s.color, position: i })))
      .select("id, name");

    const byName = (n: string) => stages?.find((s) => s.name === n)?.id;
    const eventMap: { event_key: string; stage_name: string }[] = [
      { event_key: "presupuesto_enviado", stage_name: "Presupuestado" },
      { event_key: "presupuesto_aceptado", stage_name: "Confirmado" },
      { event_key: "factura_pagada", stage_name: "Pagado" },
    ];
    const eventRows = eventMap
      .map((e) => ({ business_id: biz.id, event_key: e.event_key, stage_id: byName(e.stage_name) }))
      .filter((e) => e.stage_id);
    if (eventRows.length) await admin.from("crm_stage_events").insert(eventRows);

    await admin.from("crm_fiscal_profile").insert({ business_id: biz.id, legal_name: name });
  }

  // 7) Tipos de documento base (factura recibida, nómina...) solo para asesorías.
  if (type === "asesoria") {
    await admin.rpc("adv_seed_doc_types", { p_business_id: biz.id });
  }

  // 8) Agencia: los 8 equipos por defecto los crea el trigger de BD al insertar el negocio.
  // El primer usuario es el presidente (directiva); el resto de la directiva y los miembros
  // se dan de alta después con la función agency-members.
  if (type === "agencia") {
    const { error: memErr } = await admin.from("agency_members").insert({
      business_id: biz.id, user_id: staffId, full_name: b.staff_name?.trim() || name,
      access_level: "directiva", directiva_role: "presidente", cargo: "Presidente",
    });
    if (memErr) {
      await admin.from("businesses").delete().eq("id", biz.id); // rollback
      return json({ error: `No se pudo crear la directiva inicial: ${memErr.message}` }, 400);
    }
  }

  return json({ business: biz, staff_id: staffId });
});

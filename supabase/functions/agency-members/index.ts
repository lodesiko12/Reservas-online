// agency-members — Alta y gestión de cuentas de una agencia (tipo de negocio "agencia").
// Pueden usarla el super-admin y la directiva con puesto de presidente o secretario
// (agency_can_manage_members). No hay registro público: las cuentas las crea esta función.
// verify_jwt = true; la autorización se vuelve a comprobar aquí contra la base de datos.
//
// Acciones:
//   create          Crea la cuenta (email + contraseña) y la da de alta como miembro.
//   reset_password  Fija una contraseña nueva a un miembro de la agencia.
//   set_active      Activa/desactiva a un miembro (desactivar además bloquea el login).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";

type Body = {
  action?: "create" | "reset_password" | "set_active";
  business_id?: string;
  user_id?: string;
  email?: string;
  password?: string;
  full_name?: string;
  access_level?: "directiva" | "miembro";
  directiva_role?: "presidente" | "vicepresidente1" | "vicepresidente2" | "secretario" | "tesorero" | null;
  cargo?: string | null;
  team_ids?: string[];
  is_active?: boolean;
};

const ROLES = ["presidente", "vicepresidente1", "vicepresidente2", "secretario", "tesorero"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // 1) Autenticar a quien llama.
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData } = await admin.auth.getUser(jwt);
  const uid = userData.user?.id;
  if (!uid) return json({ error: "No autenticado" }, 401);

  const body: Body = await req.json().catch(() => ({}));
  const businessId = body.business_id;
  if (!businessId) return json({ error: "Falta business_id" }, 400);

  // 2) Debe ser una agencia y quien llama super-admin o presidente/secretario activo.
  const [{ data: biz }, { data: prof }, { data: me }] = await Promise.all([
    admin.from("businesses").select("type").eq("id", businessId).maybeSingle(),
    admin.from("profiles").select("is_super_admin").eq("id", uid).maybeSingle(),
    admin.from("agency_members").select("access_level, directiva_role, is_active")
      .eq("business_id", businessId).eq("user_id", uid).maybeSingle(),
  ]);
  if (biz?.type !== "agencia") return json({ error: "Este negocio no es una agencia." }, 400);
  const isSuperAdmin = !!prof?.is_super_admin;
  const canManage = isSuperAdmin ||
    (!!me?.is_active && me.access_level === "directiva" && ["presidente", "secretario"].includes(me.directiva_role ?? ""));
  if (!canManage) return json({ error: "Solo el presidente, el secretario o el super-admin pueden gestionar cuentas." }, 403);
  if (!(await rateLimitHit(admin, `agency-members:user:${uid}`, 60, 3600))) return tooManyRequests(3600);

  // ---------------------------------------------------------------- create
  if (body.action === "create") {
    const email = body.email?.trim().toLowerCase();
    const fullName = body.full_name?.trim();
    if (!email || !EMAIL_RE.test(email)) return json({ error: "Email no válido." }, 400);
    if (!fullName) return json({ error: "Falta el nombre." }, 400);
    if (!body.password || body.password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    const level = body.access_level === "directiva" ? "directiva" : "miembro";
    const role = level === "directiva" && body.directiva_role && ROLES.includes(body.directiva_role) ? body.directiva_role : null;
    const cargo = body.cargo?.trim() || null;

    // Los equipos indicados deben ser de esta agencia.
    const teamIds = [...new Set(body.team_ids ?? [])];
    if (teamIds.length) {
      const { data: teams } = await admin.from("agency_teams").select("id").eq("business_id", businessId).in("id", teamIds);
      if ((teams?.length ?? 0) !== teamIds.length) return json({ error: "Algún equipo no pertenece a esta agencia." }, 400);
    }

    let userId: string | undefined;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password: body.password, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (created?.user) {
      userId = created.user.id;
    } else if (createErr && /already registered|already exists/i.test(createErr.message)) {
      // Una cuenta existente solo la puede vincular el super-admin: un presidente no debe poder
      // apropiarse (ni cambiar la contraseña) de una cuenta de otra persona.
      if (!isSuperAdmin) return json({ error: "Ya existe una cuenta con ese email. Pide al administrador que la vincule." }, 409);
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!userId) return json({ error: "No se pudo localizar la cuenta existente." }, 400);
      await admin.auth.admin.updateUserById(userId, { password: body.password, email_confirm: true });
    } else {
      return json({ error: `No se pudo crear el usuario: ${createErr?.message}` }, 400);
    }

    const { error: bizUserErr } = await admin
      .from("business_users")
      .upsert({ business_id: businessId, user_id: userId, role: "staff" }, { onConflict: "business_id,user_id", ignoreDuplicates: true });
    if (bizUserErr) return json({ error: bizUserErr.message }, 400);

    const { error: memErr } = await admin.from("agency_members").upsert({
      business_id: businessId, user_id: userId, full_name: fullName,
      access_level: level, directiva_role: role, cargo, is_active: true,
    }, { onConflict: "business_id,user_id" });
    if (memErr) return json({ error: memErr.message }, 400);

    if (teamIds.length) {
      const { error: tmErr } = await admin.from("agency_team_members").upsert(
        teamIds.map((team_id) => ({ team_id, user_id: userId!, business_id: businessId })),
        { onConflict: "team_id,user_id", ignoreDuplicates: true }
      );
      if (tmErr) return json({ error: tmErr.message }, 400);
    }
    return json({ ok: true, user_id: userId });
  }

  // Resto de acciones: el objetivo debe ser miembro de esta agencia.
  if (!body.user_id) return json({ error: "Falta user_id" }, 400);
  const { data: target } = await admin.from("agency_members").select("user_id")
    .eq("business_id", businessId).eq("user_id", body.user_id).maybeSingle();
  if (!target) return json({ error: "Ese usuario no pertenece a esta agencia." }, 404);

  // --------------------------------------------------------- reset_password
  if (body.action === "reset_password") {
    if (!body.password || body.password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    if (!isSuperAdmin) {
      // Un presidente no puede cambiar la contraseña de una cuenta que sirve a otros negocios
      // ni de un super-admin.
      const [{ count }, { data: tp }] = await Promise.all([
        admin.from("business_users").select("user_id", { count: "exact", head: true }).eq("user_id", body.user_id).neq("business_id", businessId),
        admin.from("profiles").select("is_super_admin").eq("id", body.user_id).maybeSingle(),
      ]);
      if ((count ?? 0) > 0 || tp?.is_super_admin) return json({ error: "Esa cuenta no se puede modificar desde aquí." }, 403);
    }
    const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  // -------------------------------------------------------------- set_active
  if (body.action === "set_active") {
    if (typeof body.is_active !== "boolean") return json({ error: "Falta is_active" }, 400);
    if (body.user_id === uid && !isSuperAdmin) return json({ error: "No puedes desactivarte a ti mismo." }, 400);
    const { error } = await admin.from("agency_members").update({ is_active: body.is_active })
      .eq("business_id", businessId).eq("user_id", body.user_id);
    if (error) return json({ error: error.message }, 400);
    // Al desactivar se bloquea también el login, salvo que la cuenta sirva a otro negocio
    // (el bloqueo es global y le quitaría el acceso a lo demás).
    const { count } = await admin.from("business_users").select("user_id", { count: "exact", head: true })
      .eq("user_id", body.user_id).neq("business_id", businessId);
    const usedElsewhere = (count ?? 0) > 0;
    await admin.auth.admin.updateUserById(body.user_id, { ban_duration: body.is_active || usedElsewhere ? "none" : "876000h" });
    return json({ ok: true });
  }

  return json({ error: "Acción no reconocida" }, 400);
});

// admin-business-users — Gestión de miembros de un negocio (super-admin).
// Un negocio puede tener varios usuarios de staff/owner (p. ej. varios
// profesionales con acceso al panel). Solo super-admin (verify_jwt=true,
// además se comprueba is_super_admin explícitamente).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, handleOptions } from "../_shared/cors.ts";
import { rateLimitHit, tooManyRequests } from "../_shared/rateLimit.ts";
import { findUserByEmail, sendPasswordSetupLink } from "../_shared/passwordSetup.ts";

type Body = {
  action?: "list" | "add" | "remove" | "update_role";
  business_id?: string;
  user_id?: string;
  staff_email?: string;
  staff_password?: string;
  role?: "owner" | "staff";
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
  if (!prof?.is_super_admin) return json({ error: "Solo el super-admin puede gestionar usuarios de un negocio" }, 403);
  if (!(await rateLimitHit(admin, `admin-business-users:user:${uid}`, 30, 3600))) {
    return tooManyRequests(3600);
  }

  const body: Body = await req.json().catch(() => ({}));
  const businessId = body.business_id;
  if (!businessId) return json({ error: "Falta business_id" }, 400);

  if (body.action === "list") {
    const { data: rows, error } = await admin
      .from("business_users")
      .select("id, user_id, role, created_at")
      .eq("business_id", businessId)
      .order("created_at");
    if (error) return json({ error: error.message }, 400);

    const members = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: u } = await admin.auth.admin.getUserById(r.user_id);
        return { id: r.id, user_id: r.user_id, role: r.role, created_at: r.created_at, email: u.user?.email ?? "—" };
      })
    );
    return json({ members });
  }

  if (body.action === "add") {
    const email = body.staff_email?.trim();
    const role = body.role === "owner" ? "owner" : "staff";
    if (!email) return json({ error: "Falta el email." }, 400);

    if (body.staff_password && body.staff_password.length < 8) {
      return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    }

    // Se crea la cuenta (con la contraseña indicada, o sin contraseña si no se da) o se localiza la existente.
    let userId: string | undefined;
    let isNewUser = false;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, email_confirm: true, ...(body.staff_password ? { password: body.staff_password } : {}),
    });
    if (created?.user) {
      userId = created.user.id;
      isNewUser = true;
    } else if (createErr && /already registered|already exists/i.test(createErr.message)) {
      userId = (await findUserByEmail(admin, email))?.id;
      if (!userId) return json({ error: "Ese email ya está registrado pero no se pudo localizar la cuenta." }, 400);
      // Si el email ya existía y se dio contraseña, la fijamos (antes se ignoraba
      // silenciosamente y quedaba activa la contraseña anterior de la cuenta).
      if (body.staff_password) {
        const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
          password: body.staff_password, email_confirm: true,
        });
        if (updErr) return json({ error: `El email ya existía y no se pudo actualizar su contraseña: ${updErr.message}` }, 400);
      }
    } else if (createErr) {
      return json({ error: `No se pudo crear el usuario: ${createErr.message}` }, 400);
    }

    const { error: linkErr } = await admin
      .from("business_users")
      .upsert({ business_id: businessId, user_id: userId, role }, { onConflict: "business_id,user_id" });
    if (linkErr) return json({ error: linkErr.message }, 400);

    // Cuenta nueva sin contraseña: se le envía el enlace para que la elija ella misma.
    let invite: "sent" | "not_sent" | "none" = "none";
    if (isNewUser && !body.staff_password) {
      const { data: biz } = await admin.from("businesses").select("name").eq("id", businessId).maybeSingle();
      const r = await sendPasswordSetupLink(admin, email, "invite", biz?.name);
      invite = r === "sent" ? "sent" : "not_sent";
    }
    return json({ ok: true, user_id: userId, invite });
  }

  if (body.action === "update_role") {
    if (!body.user_id || !body.role) return json({ error: "Faltan user_id o role" }, 400);
    const { error } = await admin.from("business_users").update({ role: body.role })
      .eq("business_id", businessId).eq("user_id", body.user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "remove") {
    if (!body.user_id) return json({ error: "Falta user_id" }, 400);
    const { error } = await admin.from("business_users").delete()
      .eq("business_id", businessId).eq("user_id", body.user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Acción no reconocida" }, 400);
});

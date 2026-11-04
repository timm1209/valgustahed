// Valgustähed — Supabase Edge Function "kasutajad"
// Kasutajate haldus Valgustähtede admini paneelist: loo, muuda nime/rolli/aktiivsust, uus parool, kustuta.
// Toiminguid lubatakse ainult aktiivsele adminile (tabel public.kasutajad).
// Paigaldus: Supabase → Edge Functions → Deploy a new function → Via Editor → nimi "kasutajad" → kleebi see fail → Deploy.
// SUPABASE_URL ja salajane võti (uus SUPABASE_SECRET_KEYS või vana SUPABASE_SERVICE_ROLE_KEY) on funktsioonile automaatselt olemas.
// Funktsiooni seadetes lülita "Verify JWT" välja: funktsioon kontrollib sisselogimist ise (admin.auth.getUser).
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Ainult POST" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    let secret = "";
    try { const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); secret = keys.default || Object.values(keys)[0] as string || ""; } catch (_) { /* vana projekt */ }
    secret = secret || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!secret) return json({ error: "Serverifunktsioonil puudub salajane võti." }, 500);
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

    // kes küsib: tema sessioon peab olema kehtiv ja ta peab olema aktiivne admin
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who, error: whoErr } = await admin.auth.getUser(token);
    if (whoErr || !who?.user) return json({ error: "Logi uuesti sisse." }, 401);
    const { data: me } = await admin.from("kasutajad").select("roll, aktiivne").eq("id", who.user.id).single();
    if (!me || !me.aktiivne || me.roll !== "admin") return json({ error: "Selleks on vaja admini õigusi." }, 403);

    const b = await req.json().catch(() => ({}));
    const roll = b.roll === "admin" ? "admin" : "kasutaja";
    switch (b.action) {
      case "loo": {
        const email = String(b.email || "").trim().toLowerCase(), nimi = String(b.nimi || "").trim(), parool = String(b.parool || "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Vigane e-post." }, 400);
        if (parool.length < 8) return json({ error: "Parool peab olema vähemalt 8 märki." }, 400);
        const { data, error } = await admin.auth.admin.createUser({ email, password: parool, email_confirm: true, user_metadata: { nimi, roll } });
        if (error) return json({ error: /already/i.test(error.message) ? "Selle e-postiga kasutaja on juba olemas." : error.message }, 400);
        await admin.from("kasutajad").upsert({ id: data.user.id, email, nimi: nimi || email.split("@")[0], roll, aktiivne: true });
        return json({ ok: true, id: data.user.id });
      }
      case "muuda": {
        const id = String(b.id || ""); if (!id) return json({ error: "Kasutaja puudub." }, 400);
        if (id === who.user.id && (b.roll === "kasutaja" || b.aktiivne === false)) return json({ error: "Enda admini õigusi ega kontot ei saa siit ära võtta." }, 400);
        const patch: Record<string, unknown> = {};
        if (typeof b.nimi === "string") patch.nimi = b.nimi.trim();
        if (b.roll === "admin" || b.roll === "kasutaja") patch.roll = b.roll;
        if (typeof b.aktiivne === "boolean") {
          patch.aktiivne = b.aktiivne;
          const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: b.aktiivne ? "none" : "876000h" });
          if (error) return json({ error: error.message }, 400);
        }
        const { error } = await admin.from("kasutajad").update(patch).eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case "parool": {
        const id = String(b.id || ""), parool = String(b.parool || "");
        if (parool.length < 8) return json({ error: "Parool peab olema vähemalt 8 märki." }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password: parool });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      case "kustuta": {
        const id = String(b.id || "");
        if (id === who.user.id) return json({ error: "Iseennast ei saa kustutada." }, 400);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      default:
        return json({ error: "Tundmatu toiming." }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

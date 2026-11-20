import { createClient } from "npm:@supabase/supabase-js@2.119.1";

const site = "https://nogueiramateus16.github.io";
const headers = {
  "Access-Control-Allow-Origin": site,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store"
};
const reply = (status: number, message: string) => Response.json({ message }, { status, headers });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply(405, "Use POST.");
  try {
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, "Entre novamente.");
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return reply(401, "Sessão inválida.");
    const role = await db.from("lideres").select("usuario_id").eq("usuario_id", data.user.id).maybeSingle();
    if (role.error) return reply(503, "Falha ao consultar a permissão.");
    if (!role.data) return reply(403, "Acesso exclusivo do líder.");
    const { email, envio } = await req.json();
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return reply(400, "Confira o e-mail do integrante.");
    }
    if (envio === "manual") {
      const generated = await db.auth.admin.generateLink({
        type: "invite", email: email.trim(),
        options: { redirectTo: site + "/louvor_connect_adve_publicacao/login.html" }
      });
      if (generated.error || !generated.data.properties?.action_link) {
        return reply(409, "Não foi possível gerar o convite. Confira se a conta já existe.");
      }
      return Response.json({ message: "Convite pronto. Abra o e-mail preparado e toque em enviar.",
        link: generated.data.properties.action_link }, { headers });
    }
    const invite = await db.auth.admin.inviteUserByEmail(email.trim(), {
      redirectTo: site + "/louvor_connect_adve_publicacao/login.html"
    });
    if (invite.error) {
      const code = invite.error.code;
      if (code === "email_exists" || code === "user_already_exists") return reply(409, "A conta já existe. Use a recuperação de acesso.");
      if (invite.error.status === 429) return reply(429, "Limite de envio atingido. Tente mais tarde.");
      return reply(502, "O convite não foi confirmado. Confira o envio de e-mail no Supabase.");
    }
    return reply(200, "Convite enviado. O integrante deve abrir o e-mail para completar o cadastro.");
  } catch {
    return reply(400, "Não foi possível processar a solicitação.");
  }
});

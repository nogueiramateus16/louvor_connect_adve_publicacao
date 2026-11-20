import { createClient } from "npm:@supabase/supabase-js@2.119.1";

const headers = {
  "Access-Control-Allow-Origin": "https://nogueiramateus16.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const reply = (status: number, message: string) =>
  Response.json({ message }, { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply(405, "Use POST.");
  try {
    const { email, codigo, senha } = await request.json();
    if (typeof email !== "string" || email.length > 254 ||
        typeof codigo !== "string" || !/^ADVE-[0-9a-f]{32}$/.test(codigo) ||
        typeof senha !== "string" || senha.length < 12 || /^ADVE-/.test(senha) ||
        new TextEncoder().encode(senha).length > 72) {
      return reply(400, "Confira o código e a nova senha.");
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: id, error } = await admin.rpc("consumir_provisoria", { destino: email, codigo });
    if (error) return reply(503, "Serviço indisponível.");
    if (!id) return reply(403, "Código inválido, utilizado ou expirado.");
    const update = await admin.auth.admin.updateUserById(id, { password: senha });
    if (update.error) return reply(409, "A senha não foi salva. Solicite outra provisória.");
    return reply(200, "Senha definida. Entre com a nova senha.");
  } catch {
    return reply(400, "Solicitação inválida.");
  }
});

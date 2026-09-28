import { env } from "cloudflare:workers";
import { submitBetaFeedback } from "../../finance-store";
import { getMizufiUser } from "../../supabase-server";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

async function emailFeedback(input: { email: string; type: "error" | "idea"; message: string; context: unknown }) {
  const apiKey = (env as unknown as Record<string, string | undefined>).RESEND_API_KEY;
  if (!apiKey) return false;
  const details = input.context && typeof input.context === "object" ? input.context as Record<string, unknown> : {};
  const label = input.type === "error" ? "Error" : "Sugerencia";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "MiZUFi avisos <no-reply@somosmizufi.com>",
      to: ["hola@somosmizufi.com"],
      reply_to: input.email,
      subject: `${label} recibido en MiZUFi`,
      text: `${label} recibido en MiZUFi\n\nUsuario: ${input.email}\nZona: ${details.area ?? "No indicada"}\nPágina: ${details.url ?? "No indicada"}\nDispositivo: ${details.viewport ?? "No indicado"}\nInstalada como app: ${details.installed ? "Sí" : "No"}\n\nMensaje:\n${input.message}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#173b39"><div style="padding:20px;border-radius:16px;background:#e8f7f3"><strong style="color:#229e96">MiZUFi · ${escapeHtml(label)}</strong><h1 style="font-size:22px">Nuevo mensaje de la beta</h1></div><div style="padding:20px"><p><strong>Usuario:</strong> ${escapeHtml(input.email)}</p><p><strong>Zona:</strong> ${escapeHtml(details.area ?? "No indicada")}</p><p><strong>Página:</strong> ${escapeHtml(details.url ?? "No indicada")}</p><p><strong>Dispositivo:</strong> ${escapeHtml(details.viewport ?? "No indicado")}</p><p><strong>Instalada como app:</strong> ${details.installed ? "Sí" : "No"}</p><h2 style="font-size:17px">Mensaje</h2><div style="padding:16px;border-left:4px solid #229e96;background:#f5faf8;white-space:pre-wrap">${escapeHtml(input.message)}</div><p style="color:#6d817b;font-size:12px">También se ha guardado una copia en el panel beta de MiZUFi.</p></div></div>`,
    }),
  });
  return response.ok;
}

export async function POST(request: Request) {
  const user = await getMizufiUser(request);
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null) as { type?: string; message?: string; context?: unknown } | null;
  const type = body?.type === "idea" ? "idea" : "error";
  const message = String(body?.message ?? "").trim().slice(0, 2000);
  if (message.length < 5) return Response.json({ error: "Cuéntanos un poco más" }, { status: 400 });
  const rawContext = body?.context ?? {};
  const context = JSON.stringify(rawContext).slice(0, 4000);
  await submitBetaFeedback(user, { type, message, context });
  const emailSent = await emailFeedback({ email: user.email, type, message, context: rawContext }).catch(() => false);
  return Response.json({ ok: true, emailSent });
}

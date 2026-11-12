import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fnError } from "../../lib/functionError";
import { PageHeader, Spinner, EmptyState } from "../../components/ui";
import { PushCard } from "../agencia/Avisos";
import { useWaConversations, useWaMessages, type WaConversation, type WaMessage } from "./hooks";

const WINDOW_MS = 24 * 3600 * 1000;
const TYPE_LABEL: Record<string, string> = {
  image: "📷 Imagen", audio: "🎤 Audio", video: "🎬 Vídeo", document: "📄 Documento",
  sticker: "Sticker", location: "📍 Ubicación", other: "Mensaje no compatible",
};

function convTitle(c: WaConversation): string {
  if (c.customers) return [c.customers.full_name, c.customers.last_name].filter(Boolean).join(" ");
  return c.contact_name || `+${c.wa_id}`;
}

function fmtShort(iso: string, tz: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d) === new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  return sameDay
    ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false }).format(d)
    : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: tz }).format(d);
}
function fmtFull(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false }).format(new Date(iso));
}

function StatusMark({ m }: { m: WaMessage }) {
  if (m.direction !== "out") return null;
  if (m.status === "failed") return <span className="text-red-200" title={m.error ?? ""}>⚠ No enviado</span>;
  if (m.status === "sending") return <span>…</span>;
  if (m.status === "sent") return <span title="Enviado">✓</span>;
  if (m.status === "delivered") return <span title="Entregado">✓✓</span>;
  return <span className="text-sky-200" title="Leído">✓✓</span>;
}

function Bubble({ m, tz }: { m: WaMessage; tz: string }) {
  const out = m.direction === "out";
  const content = m.body?.trim() ? m.body : (TYPE_LABEL[m.msg_type] ?? TYPE_LABEL.other);
  const media = !m.body?.trim() || m.msg_type !== "text";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${out ? "bg-brand-500 text-white rounded-br-md" : "bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-md"}`}>
        {media && m.msg_type !== "text" && m.body?.trim() && <div className="text-xs opacity-70 mb-0.5">{TYPE_LABEL[m.msg_type] ?? TYPE_LABEL.other}</div>}
        <div className={`whitespace-pre-wrap break-words ${media && !m.body?.trim() ? "italic opacity-80" : ""}`}>{content}</div>
        {media && m.msg_type !== "text" && (
          <div className="text-[11px] opacity-70 mt-0.5">Los adjuntos aún no se pueden ver aquí: ábrelo desde el móvil de la clínica.</div>
        )}
        <div className={`text-[11px] mt-1 flex items-center gap-2 justify-end ${out ? "text-white/80" : "text-slate-400"}`}>
          <span>{fmtFull(m.created_at, tz)}</span>
          <StatusMark m={m} />
        </div>
        {m.status === "failed" && m.error && <div className="text-[11px] text-red-100 mt-1 break-words">{m.error}</div>}
      </div>
    </div>
  );
}

/** Buzón de WhatsApp: lista de conversaciones a la izquierda y el hilo (con respuesta) a la derecha. */
export function Mensajes() {
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const bid = business?.id ?? "";
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("c");
  const [showArchived, setShowArchived] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: convs, isLoading } = useWaConversations();
  const { data: msgs, isLoading: loadingMsgs } = useWaMessages(selectedId);

  const visible = useMemo(() => (convs ?? []).filter((c) => c.is_archived === showArchived), [convs, showArchived]);
  const selected = useMemo(() => (convs ?? []).find((c) => c.id === selectedId) ?? null, [convs, selectedId]);

  // Marca como leída la conversación abierta (también cuando llegan mensajes con ella abierta).
  useEffect(() => {
    if (!selected || selected.unread_count === 0) return;
    supabase.rpc("whatsapp_mark_read", { p_conversation_id: selected.id }).then(() => {
      qc.invalidateQueries({ queryKey: ["wa-convs", bid] });
    });
  }, [selected?.id, selected?.unread_count, bid, qc]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs?.length, selectedId]);
  useEffect(() => { setText(""); setError(null); }, [selectedId]);

  const open = selected && selected.last_inbound_at && Date.now() - new Date(selected.last_inbound_at).getTime() < WINDOW_MS;

  function select(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("c", id); else next.delete("c");
    setParams(next, { replace: true });
  }

  async function send() {
    if (!selected || !text.trim() || sending) return;
    setSending(true); setError(null);
    const { data, error: err } = await supabase.functions.invoke("whatsapp-send", { body: { conversation_id: selected.id, text: text.trim() } });
    setSending(false);
    if (err || (data as { error?: string } | null)?.error) { setError(await fnError(err, data)); }
    else setText("");
    qc.invalidateQueries({ queryKey: ["wa-msgs", bid] });
    qc.invalidateQueries({ queryKey: ["wa-convs", bid] });
  }

  async function toggleArchive() {
    if (!selected) return;
    await supabase.rpc("whatsapp_set_archived", { p_conversation_id: selected.id, p_archived: !selected.is_archived });
    qc.invalidateQueries({ queryKey: ["wa-convs", bid] });
    if (!selected.is_archived) select(null);
  }

  return (
    <div>
      <PageHeader title="Mensajes" subtitle="WhatsApp del negocio: lee y contesta desde aquí" />
      <PushCard offText="Activa las notificaciones para enterarte al momento de un mensaje nuevo, aunque tengas la app cerrada (no incluyen el texto del mensaje)." />

      <div className="card overflow-hidden grid md:grid-cols-[20rem_1fr] h-[calc(100vh-17rem)] min-h-[26rem]">
        {/* Lista */}
        <div className={`border-r border-slate-200 dark:border-slate-700 flex flex-col min-h-0 ${selectedId ? "hidden md:flex" : "flex"}`}>
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm">
            <span className="font-semibold">{showArchived ? "Archivadas" : "Conversaciones"}</span>
            <button className="text-xs text-brand-600 hover:underline" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Ver activas" : "Ver archivadas"}
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {isLoading && <div className="p-6 text-center"><Spinner /></div>}
            {!isLoading && visible.length === 0 && (
              <p className="p-6 text-sm text-slate-500 dark:text-slate-400 text-center">
                {showArchived ? "No hay conversaciones archivadas." : "Aún no ha llegado ningún mensaje."}
              </p>
            )}
            {visible.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${c.id === selectedId ? "bg-brand-50 dark:bg-slate-800" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${c.unread_count ? "font-bold" : "font-medium"}`}>{convTitle(c)}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{fmtShort(c.last_message_at, tz)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">{c.last_preview ?? ""}</span>
                  {c.unread_count > 0 && <span className="badge bg-coral-500 text-white shrink-0">{c.unread_count}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Hilo */}
        <div className={`flex-col min-h-0 ${selectedId ? "flex" : "hidden md:flex"}`}>
          {!selected ? (
            <div className="m-auto p-6 text-center text-sm text-slate-500 dark:text-slate-400">Elige una conversación de la lista.</div>
          ) : (
            <>
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <button className="md:hidden text-slate-500 text-lg" onClick={() => select(null)} aria-label="Volver">←</button>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{convTitle(selected)}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    +{selected.wa_id}{selected.customers && selected.contact_name ? ` · ${selected.contact_name}` : ""}
                  </div>
                </div>
                <button className="btn-ghost text-xs" onClick={toggleArchive}>{selected.is_archived ? "Desarchivar" : "Archivar"}</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 dark:bg-slate-900/40">
                {loadingMsgs && <div className="text-center"><Spinner /></div>}
                {(msgs ?? []).map((m) => <Bubble key={m.id} m={m} tz={tz} />)}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 p-3">
                {!open ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
                    Han pasado más de 24 h desde el último mensaje de esta persona. WhatsApp solo permite responder libremente durante 24 h: cuando vuelva a escribir podrás contestar aquí.
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea
                      className="input flex-1 resize-none"
                      rows={2}
                      maxLength={4000}
                      placeholder="Escribe una respuesta…"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
                    />
                    <button className="btn-primary" onClick={send} disabled={sending || !text.trim()}>{sending ? "Enviando…" : "Enviar"}</button>
                  </div>
                )}
                {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
                {open && <p className="text-[11px] text-slate-400 mt-1">Ctrl + Intro para enviar.</p>}
              </div>
            </>
          )}
        </div>
      </div>
      {!isLoading && (convs ?? []).length === 0 && !showArchived && (
        <div className="mt-4"><EmptyState title="Todavía no hay conversaciones" hint="Cuando alguien escriba al WhatsApp del negocio, aparecerá aquí al instante." /></div>
      )}
    </div>
  );
}

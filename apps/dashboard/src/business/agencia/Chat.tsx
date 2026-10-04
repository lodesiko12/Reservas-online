import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useBusinessId } from "../hooks";
import { ConfirmDialog, Spinner } from "../../components/ui";
import {
  memberName, useAgencyMe, useAgencyMembers, useAgencyTeams, useChatMessages, useChatUnread,
  type AgencyChatMessage,
} from "./hooks";
import { Avatar } from "./components";

type Group = { scope: string; name: string; general: boolean };

const GAP_MS = 5 * 60 * 1000;

function dayLabel(iso: string, tz: string): string {
  const d = new Date(iso);
  const ymd = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(x);
  const today = new Date();
  const yest = new Date(today.getTime() - 86400000);
  if (ymd(d) === ymd(today)) return "Hoy";
  if (ymd(d) === ymd(yest)) return "Ayer";
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(d);
}
const hhmm = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso));

/** Chat de la agencia: grupo General + un grupo por equipo. Escritorio: lista + conversación; móvil: una pantalla cada una. */
export function Chat() {
  const bid = useBusinessId();
  const { scope } = useParams();
  const { data: teams } = useAgencyTeams();
  const { data: unread } = useChatUnread();

  const groups: Group[] = useMemo(
    () => [
      { scope: bid, name: "General", general: true },
      ...(teams ?? []).filter((t) => !t.is_archived).map((t) => ({ scope: t.id, name: t.name, general: false })),
    ],
    [bid, teams]
  );
  const current = groups.find((g) => g.scope === (scope ?? bid)) ?? groups[0];

  return (
    <div className="flex gap-4 h-[calc(100dvh-11rem)] lg:h-[calc(100vh-4rem)] min-h-[320px]">
      {/* Lista de grupos */}
      <aside className={`${scope ? "hidden" : "flex"} lg:flex flex-col w-full lg:w-72 shrink-0 card overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 font-extrabold">Chat</div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {groups.map((g) => {
            const n = unread?.[g.scope] ?? 0;
            const active = current?.scope === g.scope;
            return (
              <Link
                key={g.scope} to={g.general ? "/app/chat" : `/app/chat/${g.scope}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${active ? "lg:bg-brand-50 lg:dark:bg-brand-500/10" : ""}`}
              >
                <span className={`h-10 w-10 shrink-0 rounded-full grid place-items-center text-lg ${g.general ? "bg-coral-500 text-white" : "bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200"}`}>
                  {g.general ? "📣" : "👥"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`truncate ${n ? "font-extrabold" : "font-semibold"}`}>{g.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{g.general ? "Toda la agrupación" : "Equipo"}</div>
                </div>
                {n > 0 && <span className="badge bg-coral-500 text-white">{n > 99 ? "99+" : n}</span>}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Conversación */}
      <section className={`${scope ? "flex" : "hidden"} lg:flex flex-1 min-w-0 flex-col card overflow-hidden`}>
        {current ? <Conversation key={current.scope} group={current} /> : <div className="m-auto"><Spinner /></div>}
      </section>
    </div>
  );
}

function Conversation({ group }: { group: Group }) {
  const bid = useBusinessId();
  const qc = useQueryClient();
  const { business } = useAuth();
  const tz = business?.timezone ?? "Europe/Madrid";
  const { userId, isDirectiva } = useAgencyMe();
  const { data: members } = useAgencyMembers();
  const { data: messages, isLoading } = useChatMessages(group.scope);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<AgencyChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true); // pegado al final salvo que el usuario haya subido a leer

  // Marca el grupo como leído al abrirlo y cada vez que llegan mensajes mientras está visible.
  const lastId = messages?.[messages.length - 1]?.id;
  useEffect(() => {
    if (!bid || !userId || !messages || document.visibilityState !== "visible") return;
    supabase.from("agency_chat_reads")
      .upsert({ user_id: userId, business_id: bid, scope_id: group.scope, last_read_at: new Date().toISOString() }, { onConflict: "user_id,scope_id" })
      .then(() => qc.invalidateQueries({ queryKey: ["agency_chat_unread", bid] }));
  }, [bid, userId, group.scope, lastId, messages, qc]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, isLoading]);

  function onScroll() {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError(null);
    const { error } = await supabase.from("agency_chat_messages").insert({
      business_id: bid, team_id: group.general ? null : group.scope, body,
    });
    setSending(false);
    if (error) { setError(error.message); return; }
    setText("");
    stick.current = true;
    if (inputRef.current) inputRef.current.style.height = "auto";
    qc.invalidateQueries({ queryKey: ["agency_chat_messages", bid, group.scope] });
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // En ordenador Enter envía (Mayús+Enter = salto de línea). En móvil, Enter es salto de línea.
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (e.key === "Enter" && !e.shiftKey && fine) { e.preventDefault(); send(); }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }

  async function remove() {
    if (!deleting) return;
    const m = deleting;
    setDeleting(null);
    await supabase.from("agency_chat_messages").delete().eq("id", m.id).eq("business_id", bid);
    qc.invalidateQueries({ queryKey: ["agency_chat_messages", bid, group.scope] });
  }

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <Link to="/app/chat" className="lg:hidden text-xl px-1 -ml-1" aria-label="Volver a los grupos">←</Link>
        <span className={`h-9 w-9 rounded-full grid place-items-center ${group.general ? "bg-coral-500 text-white" : "bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200"}`}>{group.general ? "📣" : "👥"}</span>
        <div className="min-w-0">
          <div className="font-extrabold truncate">{group.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{group.general ? "Toda la agrupación" : "Solo el equipo y la directiva"}</div>
        </div>
      </header>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-4 space-y-1 bg-slate-50/60 dark:bg-slate-950/40">
        {isLoading ? <div className="grid place-items-center py-10"><Spinner /></div>
          : !messages?.length ? <p className="text-center text-sm text-slate-400 py-10">Aún no hay mensajes. ¡Escribe el primero!</p>
          : messages.map((m, i) => {
              const prev = messages[i - 1];
              const mine = m.author_id === userId;
              const newDay = !prev || dayLabel(prev.created_at, tz) !== dayLabel(m.created_at, tz);
              const grouped = !!prev && !newDay && prev.author_id === m.author_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GAP_MS;
              const name = memberName(members, m.author_id);
              return (
                <div key={m.id}>
                  {newDay && <div className="text-center my-3"><span className="badge bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 capitalize">{dayLabel(m.created_at, tz)}</span></div>}
                  <div className={`flex gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"}`}>
                    {!mine && (grouped ? <span className="w-7 shrink-0" /> : <Avatar name={name} size={28} />)}
                    <div className={`group max-w-[82%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-brand-500 text-white rounded-br-md" : "bg-white text-slate-800 border border-slate-200 rounded-bl-md dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"}`}>
                      {!mine && !grouped && <div className="text-xs font-extrabold text-brand-600 dark:text-brand-300 mb-0.5">{name}</div>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <div className={`mt-0.5 flex items-center justify-end gap-2 text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>
                        {(mine || isDirectiva) && (
                          <button className="opacity-60 hover:opacity-100 underline" onClick={() => setDeleting(m)}>borrar</button>
                        )}
                        <span>{hhmm(m.created_at, tz)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {error && <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-t border-red-200">{error}</div>}
      <form className="flex items-end gap-2 p-3 border-t border-slate-200 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea
          ref={inputRef} rows={1} value={text} onChange={onInput} onKeyDown={onKeyDown} maxLength={4000}
          placeholder={`Mensaje en ${group.name}…`} className="input resize-none max-h-32 leading-snug"
        />
        <button className="btn-primary h-[38px] shrink-0" disabled={!text.trim() || sending} aria-label="Enviar">{sending ? "…" : "Enviar"}</button>
      </form>

      <ConfirmDialog
        open={!!deleting} title="Borrar mensaje" message="El mensaje se borrará para todos los del grupo."
        onConfirm={remove} onCancel={() => setDeleting(null)}
      />
    </>
  );
}

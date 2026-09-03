"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addComment, deleteComment } from "@/app/actions/sessions";
import { MAX_COMMENT_LENGTH, isValidCommentBody, canDeleteComment } from "@/lib/domain";
import { relativeTime } from "@/lib/format";
import { Avatar } from "@/components/Avatar";

/**
 * Comentarios de una salida (Pasada I-3). Lista PLANA + campo al final. Optimista y
 * serializado como las reacciones (N.2): el comentario aparece al instante, la cola
 * ordena las escrituras y el refresh trae la verdad al drenar. Si falla, se revierte con
 * aviso y SIN perder el texto (no hay que volver a teclearlo). Borra el autor o el dueño
 * de la salida. Puede comentar quien ve la salida (el detalle ya gatea eso).
 */
type UserRef = { id: string; displayName: string; avatar: string | null };
type Item = {
  id: string;
  body: string;
  createdAt: string;
  user: UserRef;
  pending?: boolean; // optimista, aún sin confirmar en el servidor
};

const toISO = (v: string | Date): string => (typeof v === "string" ? v : v.toISOString());

export function SessionComments({
  sessionId,
  comments,
  viewer,
  autoFocus,
  initialText,
  onDraftChange,
}: {
  sessionId: string;
  comments: { id: string; body: string; createdAt: string | Date; user: UserRef }[];
  viewer: UserRef;
  autoFocus?: boolean;
  // I-3.1: para conservar el borrador cuando esto vive en una hoja que se cierra y
  // reabre (feed). El padre (que sobrevive al cierre) guarda el texto y lo re-inyecta.
  initialText?: string;
  onDraftChange?: (text: string) => void;
}) {
  const router = useRouter();
  const map = (cs: typeof comments): Item[] => cs.map((c) => ({ id: c.id, body: c.body, createdAt: toISO(c.createdAt), user: c.user }));
  const [items, setItems] = useState<Item[]>(() => map(comments));
  const [text, setText] = useState(initialText ?? "");
  const [error, setError] = useState<string | null>(null);

  // Sincroniza el borrador hacia el padre (hoja del feed). En el detalle no se pasa
  // onDraftChange → no-op. No re-inyecta text (initialText solo siembra el estado
  // inicial), así que no hay bucle.
  useEffect(() => {
    onDraftChange?.(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const pending = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const nonce = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Resync con el servidor tras el refresh, solo sin escrituras en vuelo (patrón N.2).
  useEffect(() => {
    if (pending.current === 0) setItems(map(comments));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments]);

  // Llegar desde el feed con ?comment=1 (o tocar Comentar) enfoca el campo.
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "center" });
    }
  }, [autoFocus]);

  const len = text.trim().length;
  const over = text.length > MAX_COMMENT_LENGTH;
  const canSend = len > 0 && !over;

  function submit() {
    const body = text.trim();
    if (!isValidCommentBody(body)) return;
    const tempId = `tmp-${++nonce.current}`;
    setItems((cur) => [...cur, { id: tempId, body, createdAt: new Date().toISOString(), user: viewer, pending: true }]);
    setText("");
    setError(null);
    pending.current++;
    chain.current = chain.current
      .catch(() => {})
      .then(async () => {
        try {
          const res = await addComment(sessionId, body);
          if (!res.ok) throw new Error(res.error);
          setItems((cur) => cur.map((i) => (i.id === tempId ? { ...i, id: res.id, createdAt: res.createdAt, pending: false } : i)));
        } catch (e) {
          // Falla del servidor O de red (throw): revierte y NO pierde el texto.
          setItems((cur) => cur.filter((i) => i.id !== tempId));
          setText((t) => (t ? t : body)); // sin pisar lo nuevo que haya escrito
          setError(e instanceof Error && e.message ? e.message : "No se pudo comentar. Reintenta.");
        }
      })
      .finally(() => {
        pending.current--;
        if (pending.current === 0) router.refresh();
      });
  }

  function remove(id: string) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const victim = items[idx];
    setItems((cur) => cur.filter((i) => i.id !== id));
    setError(null);
    pending.current++;
    chain.current = chain.current
      .catch(() => {})
      .then(async () => {
        try {
          const res = await deleteComment(id);
          if (!res.ok) throw new Error(res.error);
        } catch (e) {
          setItems((cur) => {
            const n = [...cur];
            n.splice(Math.min(idx, n.length), 0, victim); // reinserta en su lugar
            return n;
          });
          setError(e instanceof Error && e.message ? e.message : "No se pudo borrar. Reintenta.");
        }
      })
      .finally(() => {
        pending.current--;
        if (pending.current === 0) router.refresh();
      });
  }

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 11 }}>Comentarios{items.length > 0 ? ` · ${items.length}` : ""}</div>

      {/* Lista vacía: no se muestra nada; el campo de abajo basta. */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 14 }}>
          {items.map((c) => {
            const mine = c.user.id === viewer.id;
            const canDelete = !c.pending && canDeleteComment({ authorId: c.user.id, viewerId: viewer.id });
            return (
              <div key={c.id} style={{ display: "flex", gap: 10, opacity: c.pending ? 0.6 : 1 }}>
                <Avatar avatar={c.user.avatar} size={32} radius={10} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ font: "600 14px var(--font-sans)", color: "var(--color-crema)" }}>{mine ? "Tú" : c.user.displayName}</span>
                    <span style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue-2)" }}>{c.pending ? "enviando…" : relativeTime(new Date(c.createdAt))}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        aria-label="Borrar comentario"
                        style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--color-tenue)", cursor: "pointer", font: "500 12px var(--font-sans)", padding: 2 }}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                  <div style={{ font: "400 14.5px/1.5 var(--font-sans)", color: "#D6C7AE", marginTop: 2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Campo al final */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          id="fd-comment-input"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Suéltalo..."
          rows={2}
          className="field"
          style={{ resize: "none", height: "auto", minHeight: 44, lineHeight: 1.4, padding: "10px 13px" }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ font: "500 12px var(--font-sans)", color: over ? "var(--color-alerta)" : "var(--color-tenue-2)" }}>
            {text.length > MAX_COMMENT_LENGTH - 40 ? `${text.length}/${MAX_COMMENT_LENGTH}` : ""}
          </span>
          <button type="button" className="btn btn-primary" style={{ height: 40, padding: "0 20px", width: "auto" }} disabled={!canSend} onClick={submit}>
            Comentar
          </button>
        </div>
        {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}
      </div>
    </section>
  );
}

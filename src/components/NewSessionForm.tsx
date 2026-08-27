"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BeerSheet, type SheetDraft } from "@/components/BeerSheet";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { createSession } from "@/app/actions/sessions";
import { searchUsersAction, searchBeersAction } from "@/app/actions/beers";
import { todayInputValue, FORMAT_LABEL } from "@/lib/format";
import type { BeerFormat } from "@/lib/domain";
import type { BeerOption } from "@/lib/beer";

interface LocalCheckIn {
  key: string;
  beer: BeerOption;
  format: BeerFormat;
  rating: number; // 0 = sin calificar
  quantity: number;
}
interface LocalTag {
  key: string;
  kind: "user" | "text";
  label: string;
  avatar?: string | null;
  userId?: string;
  text?: string;
}
type UserOpt = { id: string; displayName: string; avatar: string | null };

function yesterdayInputValue() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function RowRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [editing, setEditing] = useState(value > 0);
  if (!editing && value === 0) {
    return (
      <button type="button" onClick={() => setEditing(true)} style={{ font: "500 11.5px var(--font-sans)", color: "var(--color-tenue-2)", border: "1px dashed #3A2A1A", borderRadius: 999, padding: "5px 11px", background: "transparent", cursor: "pointer" }}>
        Calificar
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} de 5`}
          onClick={() => {
            if (value === n) {
              onChange(0);
              setEditing(false);
            } else onChange(n);
          }}
          style={{ padding: "6px 2px", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <span style={{ width: 7, height: 15, borderRadius: 2, background: n <= value ? "var(--color-ambar)" : "#3A2A1A", display: "block" }} />
        </button>
      ))}
    </span>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--color-borde)", borderRadius: 13, overflow: "hidden", background: "var(--color-barra-alta)", flex: "none" }}>
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} style={{ width: 44, height: 46, border: "none", background: "transparent", font: "600 21px var(--font-sans)", color: "var(--color-tenue)", cursor: "pointer" }}>−</button>
      <span style={{ width: 34, textAlign: "center", font: "700 19px var(--font-display)", color: "var(--color-crema)" }}>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(99, value + 1))} style={{ width: 44, height: 46, border: "none", background: "var(--color-borde)", font: "600 21px var(--font-sans)", color: "var(--color-ambar)", cursor: "pointer" }}>+</button>
    </div>
  );
}

export function NewSessionForm() {
  const router = useRouter();
  const [dateMode, setDateMode] = useState<"hoy" | "ayer" | "otra">("hoy");
  const [dateValue, setDateValue] = useState(todayInputValue());
  const [place, setPlace] = useState("");
  const [tags, setTags] = useState<LocalTag[]>([]);
  const [checkIns, setCheckIns] = useState<LocalCheckIn[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [recent, setRecent] = useState<BeerOption[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [textInput, setTextInput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    searchUsersAction("").then((u) => setUsers(u as UserOpt[]));
    searchBeersAction("").then((b) => setRecent(b.slice(0, 8)));
  }, []);

  let seq = 0;
  const newKey = () => `${Date.now()}-${seq++}-${Math.round(performance.now())}`;
  const total = checkIns.reduce((s, c) => s + c.quantity, 0);

  function toggleUser(u: UserOpt) {
    setTags((cur) => {
      const has = cur.some((t) => t.userId === u.id);
      if (has) return cur.filter((t) => t.userId !== u.id);
      return [...cur, { key: newKey(), kind: "user", label: u.displayName, avatar: u.avatar, userId: u.id }];
    });
  }
  function addText(text: string) {
    setTags((cur) => [...cur, { key: newKey(), kind: "text", label: text, text }]);
  }
  function addFromSheet(d: SheetDraft) {
    setCheckIns((cur) => [...cur, { key: newKey(), beer: d.beer, format: d.format, rating: d.rating, quantity: 1 }]);
  }
  function quickAdd(b: BeerOption) {
    let lastFormat: BeerFormat = "BOTELLA";
    try {
      const v = window.localStorage.getItem("fd:lastFormat");
      if (v === "BOTELLA" || v === "LATA" || v === "JARRA" || v === "PINTA") lastFormat = v;
    } catch {}
    setCheckIns((cur) => [...cur, { key: newKey(), beer: b, format: lastFormat, rating: 0, quantity: 1 }]);
  }

  async function submit() {
    setError(null);
    if (checkIns.length === 0) {
      setError("Agrega al menos una cerveza");
      return;
    }
    const date = dateMode === "hoy" ? todayInputValue() : dateMode === "ayer" ? yesterdayInputValue() : dateValue;
    setBusy(true);
    try {
      const res = await createSession({
        date,
        placeName: place,
        notes: "",
        tags: tags.map((t) => (t.kind === "user" ? { taggedUserId: t.userId } : { freeText: t.text })),
        checkIns: checkIns.map((c) => ({ beerId: c.beer.id, quantity: c.quantity, format: c.format, rating: c.rating >= 1 ? c.rating : null })),
      });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      router.push(`/sessions/${res.id}`);
      router.refresh();
    } catch {
      setError("Algo salió mal, intenta de nuevo");
      setBusy(false);
    }
  }

  const freeTextTags = tags.filter((t) => t.kind === "text");

  return (
    <>
      <div style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* CUÁNDO */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Cuándo</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["hoy", "ayer", "otra"] as const).map((m) => {
              const active = dateMode === m;
              return (
                <button key={m} type="button" onClick={() => setDateMode(m)} style={{ flex: 1, height: 52, borderRadius: 15, cursor: "pointer", font: `${active ? 700 : 500} 15.5px var(--font-sans)`, background: active ? "var(--color-ambar)" : "var(--color-barra-alta)", color: active ? "var(--color-tinta)" : "var(--color-tenue)", border: active ? "none" : "1px solid var(--color-borde)" }}>
                  {m === "hoy" ? "Hoy" : m === "ayer" ? "Ayer" : "Otra fecha"}
                </button>
              );
            })}
          </div>
          {dateMode === "otra" && (
            <input type="date" className="field" style={{ marginTop: 9 }} value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
          )}
        </section>

        {/* DÓNDE */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Dónde <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", fontSize: 12, color: "var(--color-tenue-2)" }}>· opcional</span>
          </div>
          <input className="field" placeholder="Bar, casa, parque…" value={place} onChange={(e) => setPlace(e.target.value)} />
        </section>

        {/* CON QUIÉN */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Con quién</div>
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start", overflowX: "auto", paddingBottom: 4 }} className="no-scrollbar">
            {users.map((u) => {
              const on = tags.some((t) => t.userId === u.id);
              return (
                <button key={u.id} type="button" onClick={() => toggleUser(u)} style={{ textAlign: "center", width: 46, flex: "none", background: "transparent", border: "none", cursor: "pointer", opacity: on ? 1 : 0.5 }}>
                  <span style={{ display: "inline-block", borderRadius: 14, outline: on ? "2.5px solid var(--color-ambar)" : "none", outlineOffset: 2 }}>
                    <Avatar avatar={u.avatar} size={46} radius={14} />
                  </span>
                  <span style={{ display: "block", marginTop: 5, font: `${on ? 600 : 500} 11.5px var(--font-sans)`, color: on ? "var(--color-crema)" : "var(--color-tenue)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.displayName}</span>
                </button>
              );
            })}
            <button type="button" onClick={() => setTextInput(textInput === null ? "" : null)} style={{ textAlign: "center", width: 46, flex: "none", background: "transparent", border: "none", cursor: "pointer" }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, border: "1px dashed #4A3A28", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-ambar)" }}>
                <Icon name="plus" size={22} />
              </span>
              <span style={{ display: "block", marginTop: 5, font: "500 11.5px var(--font-sans)", color: "var(--color-tenue)" }}>Sin app</span>
            </button>
          </div>
          {textInput !== null && (
            <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
              <input className="field" style={{ height: 44 }} placeholder="Compañía sin app…" value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && textInput.trim()) { addText(textInput.trim()); setTextInput(""); } }} />
              <button type="button" className="btn btn-ghost" style={{ height: 44 }} onClick={() => { if (textInput.trim()) { addText(textInput.trim()); setTextInput(""); } }}>Agregar</button>
            </div>
          )}
          {freeTextTags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
              {freeTextTags.map((t) => (
                <span key={t.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #4A3A28", borderRadius: 999, padding: "5px 10px", font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>
                  {t.label}
                  <button type="button" onClick={() => setTags((cur) => cur.filter((x) => x.key !== t.key))} aria-label="Quitar" style={{ background: "none", border: "none", color: "var(--color-tenue)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* OTRA VEZ */}
        {recent.length > 0 && checkIns.length === 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
              <span className="eyebrow">Otra vez</span>
              <span style={{ font: "400 11.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>1 toque = 1 cerveza</span>
            </div>
            <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4 }} className="no-scrollbar">
              {recent.slice(0, 6).map((b) => (
                <span key={b.id} style={{ flex: "none", width: 160, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 16, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ font: "600 14px/1.2 var(--font-sans)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
                    <span style={{ font: "400 11.5px var(--font-sans)", color: "var(--color-tenue)" }}>{b.brewery}</span>
                  </span>
                  <button type="button" onClick={() => quickAdd(b)} aria-label={`Agregar ${b.name}`} style={{ width: 34, height: 34, borderRadius: 11, background: "var(--color-ambar)", color: "var(--color-tinta)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", border: "none", cursor: "pointer" }}>
                    <Icon name="plus" size={19} />
                  </button>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* EN ESTA SALIDA */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
            <span className="eyebrow">En esta salida</span>
            <span style={{ font: "600 12.5px var(--font-sans)", color: "var(--color-ambar)" }}>{total} unidad{total !== 1 ? "es" : ""}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {checkIns.map((c) => (
              <div key={c.key} style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 18, padding: "10px 13px", display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 15.5px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.beer.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
                    <span style={{ font: "500 11.5px var(--font-sans)", color: "var(--color-ambar)", background: "#2E2217", borderRadius: 999, padding: "3px 9px" }}>{FORMAT_LABEL[c.format]}</span>
                    <RowRating value={c.rating} onChange={(v) => setCheckIns((cur) => cur.map((x) => (x.key === c.key ? { ...x, rating: v } : x)))} />
                    <button type="button" onClick={() => setCheckIns((cur) => cur.filter((x) => x.key !== c.key))} aria-label="Quitar" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--color-tenue)", cursor: "pointer", fontSize: 16 }}>×</button>
                  </div>
                </div>
                <Stepper value={c.quantity} onChange={(n) => setCheckIns((cur) => cur.map((x) => (x.key === c.key ? { ...x, quantity: n } : x)))} />
              </div>
            ))}
            <button type="button" className="btn btn-dashed" style={{ width: "100%" }} onClick={() => setSheetOpen(true)}>
              <Icon name="search" size={20} /> Buscar o crear cerveza
            </button>
          </div>
        </section>

        {error && <p style={{ color: "var(--color-alerta)", font: "500 14px var(--font-sans)", margin: 0 }}>{error}</p>}
      </div>

      {/* CTA fijo */}
      <div style={{ position: "sticky", bottom: 0, padding: "12px 18px calc(env(safe-area-inset-bottom,0px) + 18px)", background: "linear-gradient(180deg,rgba(18,14,10,0),var(--color-noche) 30%)", borderTop: "1px solid #241A12", marginTop: 16 }}>
        <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={submit}>
          {busy ? "Guardando…" : "Guardar salida"}
        </button>
      </div>

      <BeerSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={addFromSheet} />
    </>
  );
}

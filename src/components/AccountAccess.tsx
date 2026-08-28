"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { addRecoveryEmail, setAccountPassword } from "@/app/actions/account";

const labelStyle: React.CSSProperties = { display: "block", font: "500 12.5px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 };
const rowNote: React.CSSProperties = { font: "400 12px/1.45 var(--font-sans)", color: "var(--color-tenue-2)", margin: "6px 0 0" };

export function AccountAccess({
  email,
  hasPassword,
  passkeyCount,
}: {
  email: string | null;
  hasPassword: boolean;
  passkeyCount: number;
}) {
  const [curEmail, setCurEmail] = useState(email);
  const [pkCount, setPkCount] = useState(passkeyCount);
  const [hasPw, setHasPw] = useState(hasPassword);

  // formularios
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailVal, setEmailVal] = useState("");
  const [pwVal, setPwVal] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [busy, setBusy] = useState<null | "email" | "pw" | "passkey">(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function saveEmail() {
    setMsg(null);
    setBusy("email");
    const res = await addRecoveryEmail(emailVal);
    setBusy(null);
    if (res.ok) {
      setCurEmail(emailVal.trim().toLowerCase());
      setEmailOpen(false);
      setEmailVal("");
      setMsg({ kind: "ok", text: "Correo de recuperación guardado." });
    } else setMsg({ kind: "err", text: res.error });
  }

  async function savePassword() {
    setMsg(null);
    setBusy("pw");
    const res = await setAccountPassword(pwVal);
    setBusy(null);
    if (res.ok) {
      setHasPw(true);
      setPwOpen(false);
      setPwVal("");
      setMsg({ kind: "ok", text: "Contraseña guardada. Ya puedes entrar con correo y contraseña." });
    } else setMsg({ kind: "err", text: res.error });
  }

  async function addPasskey() {
    setMsg(null);
    setBusy("passkey");
    try {
      const res = await authClient.passkey.addPasskey({ authenticatorAttachment: "platform" });
      if (res?.error) setMsg({ kind: "err", text: res.error.message ?? "No se pudo crear la passkey" });
      else {
        setPkCount((n) => n + 1);
        setMsg({ kind: "ok", text: "Passkey agregada a este dispositivo." });
      }
    } catch {
      setMsg({ kind: "err", text: "Tu dispositivo canceló o no soporta passkeys." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 11 }}>Cuenta y acceso</div>
      <div className="card" style={{ padding: 15, display: "flex", flexDirection: "column", gap: 16 }}>
        {msg && (
          <p role="status" style={{ margin: 0, font: "500 13px var(--font-sans)", color: msg.kind === "ok" ? "var(--color-botella)" : "var(--color-alerta)" }}>
            {msg.text}
          </p>
        )}

        {/* Passkey */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ font: "600 14.5px var(--font-sans)" }}>Passkey (FaceID)</span>
            <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>{pkCount > 0 ? `${pkCount} activa${pkCount > 1 ? "s" : ""}` : "ninguna"}</span>
          </div>
          <p style={rowNote}>Es tu forma principal de entrar. Puedes tener una por cada dispositivo.</p>
          <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 46, marginTop: 10 }} onClick={addPasskey} disabled={busy === "passkey"}>
            {busy === "passkey" ? "Abriendo…" : "Agregar passkey a este dispositivo"}
          </button>
        </div>

        <div style={{ height: 1, background: "var(--color-borde)" }} />

        {/* Correo de recuperación */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ font: "600 14.5px var(--font-sans)" }}>Correo de recuperación</span>
            <span style={{ font: "400 12.5px var(--font-sans)", color: curEmail ? "var(--color-crema)" : "var(--color-tenue)" }}>{curEmail ?? "sin correo"}</span>
          </div>
          <p style={rowNote}>Sirve para recuperar tu cuenta si cambias de teléfono o pierdes la passkey.</p>
          {emailOpen ? (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <input className="field" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={emailVal} onChange={(e) => setEmailVal(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-primary" style={{ flex: 1, height: 46 }} onClick={saveEmail} disabled={busy === "email"}>
                  {busy === "email" ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" className="btn btn-ghost" style={{ height: 46 }} onClick={() => { setEmailOpen(false); setEmailVal(""); }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 46, marginTop: 10 }} onClick={() => { setEmailOpen(true); setEmailVal(curEmail ?? ""); }}>
              {curEmail ? "Cambiar correo" : "Agregar correo"}
            </button>
          )}
        </div>

        {/* Contraseña (método alterno) — solo tras tener correo */}
        <div style={{ height: 1, background: "var(--color-borde)" }} />
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ font: "600 14.5px var(--font-sans)" }}>Contraseña</span>
            <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>{hasPw ? "configurada" : "no configurada"}</span>
          </div>
          <p style={rowNote}>Método alterno para entrar si la passkey falla. Necesitas un correo primero.</p>
          {!hasPw && curEmail && (pwOpen ? (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <input className="field" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={pwVal} onChange={(e) => setPwVal(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-primary" style={{ flex: 1, height: 46 }} onClick={savePassword} disabled={busy === "pw"}>
                  {busy === "pw" ? "Guardando…" : "Guardar"}
                </button>
                <button type="button" className="btn btn-ghost" style={{ height: 46 }} onClick={() => { setPwOpen(false); setPwVal(""); }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 46, marginTop: 10 }} onClick={() => setPwOpen(true)}>Agregar contraseña</button>
          ))}
          {!hasPw && !curEmail && <p style={{ ...rowNote, color: "var(--color-tenue-2)" }}>Agrega un correo de recuperación para habilitar la contraseña.</p>}
        </div>
      </div>
    </section>
  );
}

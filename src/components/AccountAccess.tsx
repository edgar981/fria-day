"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { addRecoveryEmail, setAccountPassword, deletePasskey } from "@/app/actions/account";

const rowNote: React.CSSProperties = { font: "400 12px/1.45 var(--font-sans)", color: "var(--color-tenue-2)", margin: "6px 0 0" };

type PasskeyInfo = { id: string; name: string; synced: boolean; created: string | null };

export function AccountAccess({
  email,
  hasPassword,
  passkeys,
}: {
  email: string | null;
  hasPassword: boolean;
  passkeys: PasskeyInfo[];
}) {
  const router = useRouter();
  const [curEmail, setCurEmail] = useState(email);
  const [pks, setPks] = useState(passkeys);
  const [hasPw, setHasPw] = useState(hasPassword);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailVal, setEmailVal] = useState("");
  const [pwVal, setPwVal] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [busy, setBusy] = useState<null | "email" | "pw" | "passkey" | string>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Guardarraíl: no dejar al usuario sin acceso. La última passkey no se puede
  // borrar si no hay contraseña ni correo de recuperación.
  const lastBlocked = pks.length === 1 && !hasPw && !curEmail;

  async function saveEmail() {
    setMsg(null); setBusy("email");
    const res = await addRecoveryEmail(emailVal);
    setBusy(null);
    if (res.ok) { setCurEmail(emailVal.trim().toLowerCase()); setEmailOpen(false); setEmailVal(""); setMsg({ kind: "ok", text: "Correo de recuperación guardado." }); }
    else setMsg({ kind: "err", text: res.error });
  }
  async function savePassword() {
    setMsg(null); setBusy("pw");
    const res = await setAccountPassword(pwVal);
    setBusy(null);
    if (res.ok) { setHasPw(true); setPwOpen(false); setPwVal(""); setMsg({ kind: "ok", text: "Contraseña guardada. Ya puedes entrar con correo y contraseña." }); }
    else setMsg({ kind: "err", text: res.error });
  }
  async function addPasskey() {
    setMsg(null); setBusy("passkey");
    try {
      const res = await authClient.passkey.addPasskey({ authenticatorAttachment: "platform" });
      if (res?.error) setMsg({ kind: "err", text: res.error.message ?? "No se pudo crear la passkey" });
      else { setMsg({ kind: "ok", text: "Passkey agregada a este dispositivo." }); router.refresh(); }
    } catch { setMsg({ kind: "err", text: "Tu dispositivo canceló o no soporta passkeys." }); }
    finally { setBusy(null); }
  }
  async function removePasskey(id: string) {
    setMsg(null); setBusy(id);
    const res = await deletePasskey(id);
    setBusy(null);
    if (res.ok) { setPks((l) => l.filter((p) => p.id !== id)); setMsg({ kind: "ok", text: "Passkey eliminada." }); router.refresh(); }
    else setMsg({ kind: "err", text: res.error });
  }

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 11 }}>Cuenta y acceso</div>
      <div className="card" style={{ padding: 15, display: "flex", flexDirection: "column", gap: 16 }}>
        {msg && (
          <p role="status" style={{ margin: 0, font: "500 13px var(--font-sans)", color: msg.kind === "ok" ? "var(--color-botella)" : "var(--color-alerta)" }}>{msg.text}</p>
        )}

        {/* Passkeys */}
        <div>
          <div style={{ font: "600 14.5px var(--font-sans)", marginBottom: 4 }}>Passkeys (FaceID)</div>
          <p style={rowNote}>Tu forma principal de entrar. Una por dispositivo.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 11 }}>
            {pks.length === 0 && (
              <p style={{ ...rowNote, color: "var(--color-tenue)" }}>No tienes passkeys en esta cuenta.</p>
            )}
            {pks.map((p) => {
              const blocked = lastBlocked; // solo aplica cuando es la única
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 14, padding: "10px 12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 14px var(--font-sans)", display: "flex", alignItems: "center", gap: 7 }}>
                      {p.name}
                      {p.synced && <span style={{ font: "600 10px var(--font-sans)", letterSpacing: ".04em", color: "var(--color-botella)", border: "1px solid #2E5C46", borderRadius: 6, padding: "1px 5px" }}>SINCRONIZADA</span>}
                    </div>
                    {p.created && <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: 3 }}>Creada el {p.created}</div>}
                  </div>
                  {blocked ? (
                    <span aria-hidden style={{ color: "var(--color-tenue-2)", fontSize: 16 }} title="Bloqueada">🔒</span>
                  ) : (
                    <button type="button" className="btn-danger" style={{ fontSize: 13.5 }} onClick={() => removePasskey(p.id)} disabled={busy === p.id}>
                      {busy === p.id ? "Eliminando…" : "Eliminar"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Motivo del bloqueo (no solo botón deshabilitado) */}
          {lastBlocked && (
            <p style={{ font: "400 12px/1.5 var(--font-sans)", color: "var(--color-alerta)", margin: "9px 0 0" }}>
              No puedes eliminar tu única forma de entrar. Agrega una contraseña o un correo de recuperación abajo y luego podrás quitarla.
            </p>
          )}

          <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 46, marginTop: 11 }} onClick={addPasskey} disabled={busy === "passkey"}>
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
                <button type="button" className="btn btn-primary" style={{ flex: 1, height: 46 }} onClick={saveEmail} disabled={busy === "email"}>{busy === "email" ? "Guardando…" : "Guardar"}</button>
                <button type="button" className="btn btn-ghost" style={{ height: 46 }} onClick={() => { setEmailOpen(false); setEmailVal(""); }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 46, marginTop: 10 }} onClick={() => { setEmailOpen(true); setEmailVal(curEmail ?? ""); }}>{curEmail ? "Cambiar correo" : "Agregar correo"}</button>
          )}
        </div>

        <div style={{ height: 1, background: "var(--color-borde)" }} />

        {/* Contraseña (método alterno) */}
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
                <button type="button" className="btn btn-primary" style={{ flex: 1, height: 46 }} onClick={savePassword} disabled={busy === "pw"}>{busy === "pw" ? "Guardando…" : "Guardar"}</button>
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

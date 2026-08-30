"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { AvatarPicker } from "@/components/AvatarPicker";
import { authClient } from "@/lib/auth-client";
import { registerWithInvite, validateInviteCode } from "@/app/actions/auth";
import { addRecoveryEmail } from "@/app/actions/account";

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <span key={n} style={{ height: 5, flex: 1, borderRadius: 99, background: n <= step ? "var(--color-ambar)" : "var(--color-borde)" }} />
      ))}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", font: "500 13px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 };

export function RegisterWizard({ initialCode = "" }: { initialCode?: string }) {
  const [method, setMethod] = useState<"passkey" | "password">("passkey");
  const [step, setStep] = useState(1);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();

  // Si el dispositivo no soporta WebAuthn, el método por defecto es contraseña.
  useEffect(() => {
    if (typeof window !== "undefined" && !window.PublicKeyCredential) setMethod("password");
  }, []);

  async function next1() {
    setError(null);
    if (!code.trim()) return setError("Escribe tu código de invitación");
    setChecking(true);
    const res = await validateInviteCode(code.trim());
    setChecking(false);
    if (!res.ok) return setError(res.error);
    setStep(2);
  }

  // --- Alta con passkey ---
  async function createPasskey() {
    setError(null);
    if (!name.trim()) { setStep(2); return setError("Pon tu nombre"); }
    setCreating(true);
    try {
      const res = await authClient.passkey.addPasskey({
        context: JSON.stringify({ code: code.trim(), name: name.trim(), avatar }),
        authenticatorAttachment: "platform",
        createSession: true,
      });
      if (res?.error) {
        const m = res.error.message ?? "";
        // Errores de invitación → volver al paso 1.
        if (/código|invitaci|expiró|usado/i.test(m)) { setStep(1); setError(m); }
        else setError(m || "No se pudo crear la passkey. Prueba otra forma de entrar.");
        return;
      }
      // Sesión ya establecida por createSession:true → ofrecer correo de recuperación.
      setStep(4);
    } catch {
      setError("Tu dispositivo canceló o no soporta passkeys. Prueba con correo y contraseña.");
    } finally {
      setCreating(false);
    }
  }

  // --- Alta con correo + contraseña (alterno) ---
  function nextPwIdentity() {
    setError(null);
    if (!name.trim()) return setError("Pon tu nombre");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Revisa tu correo");
    if (password.length < 8) return setError("La contraseña necesita mínimo 8 caracteres");
    setStep(3);
  }
  function finishPassword() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("code", code.trim());
      fd.set("displayName", name.trim());
      fd.set("email", email.trim());
      fd.set("password", password);
      if (avatar) fd.set("avatar", avatar);
      const res = await registerWithInvite(undefined, fd);
      if (res?.error) {
        setError(res.error);
        if (/código|invitaci/i.test(res.error)) setStep(1);
      }
    });
  }

  const backBtn = (onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label="Atrás" style={{ width: 44, height: 44, borderRadius: 14, background: "var(--color-barra)", border: "1px solid var(--color-borde)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-crema)" }}>
      <Icon name="back" size={22} />
    </button>
  );
  const errorLine = error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 14px var(--font-sans)", margin: 0 }}>{error}</p>;
  const totalSteps = method === "passkey" ? 3 : 3;

  // ---------- PASO 1 · código ----------
  if (step === 1) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ background: "linear-gradient(160deg,#D2700C,#A85207)", padding: "calc(36px + env(safe-area-inset-top)) 26px 0" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/friaday-icon.png" alt="" width={86} height={86} style={{ borderRadius: 24, display: "block", boxShadow: "0 12px 30px rgba(0,0,0,.28)" }} />
          <div style={{ font: "800 48px/.95 var(--font-display)", letterSpacing: "-.035em", color: "var(--color-espuma)", marginTop: 20 }}>FriaDay</div>
          <div style={{ font: "500 16px/1.35 var(--font-sans)", color: "rgba(251,240,213,.85)", margin: "10px 0 28px" }}>
            El parche lleva la cuenta.<br />Nadie más está invitado.
          </div>
          <div style={{ height: 16, background: "radial-gradient(circle at 50% 0,#FBF0D5 12px,transparent 12.5px) 0 0/26px 16px repeat-x" }} />
        </div>
        <div style={{ flex: 1, padding: "26px 26px 0", display: "flex", flexDirection: "column", gap: 20 }}>
          <Progress step={1} total={totalSteps} />
          {errorLine}
          <div>
            <div className="eyebrow" style={{ marginBottom: 11 }}>Tu código de invitación</div>
            <input
              className="field"
              style={{ height: 58, fontSize: 22, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", textAlign: "center", fontFamily: "var(--font-display)" }}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC2345"
              autoCapitalize="characters"
            />
            <p style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--color-tenue)", margin: "11px 0 0" }}>
              Te lo manda alguien que ya está adentro. Cada código sirve una sola vez.
            </p>
          </div>
          <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={next1} disabled={checking}>
            {checking ? "Verificando…" : "Continuar"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: 1, height: 1, background: "#241A12" }} />
            <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>o</span>
            <span style={{ flex: 1, height: 1, background: "#241A12" }} />
          </div>
          <Link href="/login" className="btn btn-ghost" style={{ width: "100%", height: 52 }}>Ya tengo cuenta</Link>
        </div>
      </div>
    );
  }

  // ---------- PASO 2 · identidad ----------
  if (step === 2) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "calc(16px + env(safe-area-inset-top)) 26px 0", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{backBtn(() => setStep(1))}<span style={{ font: "800 21px var(--font-display)", letterSpacing: "-.02em" }}>Tus datos</span></div>
        <Progress step={2} total={totalSteps} />
        {errorLine}
        {method === "passkey" ? (
          <>
            <div style={{ display: "grid", gap: 14 }}>
              <div><label style={labelStyle} htmlFor="name">Tu nombre</label><input id="name" className="field" placeholder="Como te dicen" value={name} onChange={(e) => setName(e.target.value)} /></div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 11 }}>¿Quién eres en el parche?</div>
              <AvatarPicker value={avatar} onSelect={setAvatar} />
            </div>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => { if (!name.trim()) return setError("Pon tu nombre"); setError(null); setStep(3); }}>Continuar</button>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gap: 14 }}>
              <div><label style={labelStyle} htmlFor="name">Tu nombre</label><input id="name" className="field" placeholder="Como te dicen" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label style={labelStyle} htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div>
                <label style={labelStyle} htmlFor="password">Contraseña</label>
                <input id="password" type="password" autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
                <p style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue-2)", margin: "6px 0 0" }}>Mínimo 8 caracteres.</p>
              </div>
            </div>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={nextPwIdentity}>Continuar</button>
          </>
        )}

        {/* Enlace discreto para alternar método */}
        <button
          type="button"
          onClick={() => { setError(null); setMethod((m) => (m === "passkey" ? "password" : "passkey")); }}
          style={{ background: "none", border: "none", color: "var(--color-tenue)", font: "500 13px var(--font-sans)", textAlign: "center", cursor: "pointer", padding: 4 }}
        >
          {method === "passkey" ? "Prefiero entrar con correo y contraseña" : "Prefiero usar una passkey (FaceID)"}
        </button>
      </div>
    );
  }

  // ---------- PASO 3 ----------
  if (step === 3 && method === "passkey") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "calc(16px + env(safe-area-inset-top)) 26px 0", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{backBtn(() => setStep(2))}</div>
        <Progress step={3} total={totalSteps} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, textAlign: "center", paddingBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", color: "var(--color-ambar)", fontSize: 34 }}>🔒</div>
          <div style={{ font: "800 30px/1.08 var(--font-display)", letterSpacing: "-.025em" }}>Crea tu passkey</div>
          <p style={{ font: "400 15px/1.5 var(--font-sans)", color: "var(--color-tenue)", margin: "0 auto", maxWidth: 320 }}>
            Sin contraseñas: entras con FaceID (o el desbloqueo de tu teléfono). Queda guardada en este dispositivo.
          </p>
          {errorLine}
        </div>
        <div style={{ padding: "0 0 calc(env(safe-area-inset-bottom,0px) + 20px)", display: "grid", gap: 12 }}>
          <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={createPasskey} disabled={creating}>
            {creating ? "Abriendo FaceID…" : "Crear passkey y entrar"}
          </button>
          <button type="button" onClick={() => { setError(null); setMethod("password"); setStep(2); }} style={{ background: "none", border: "none", color: "var(--color-tenue)", font: "500 13px var(--font-sans)", cursor: "pointer", padding: 4 }}>
            Otra forma de entrar
          </button>
        </div>
      </div>
    );
  }

  if (step === 3 && method === "password") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "calc(16px + env(safe-area-inset-top)) 26px 0", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{backBtn(() => setStep(2))}</div>
        <Progress step={3} total={totalSteps} />
        <div>
          <div style={{ font: "800 30px/1.08 var(--font-display)", letterSpacing: "-.025em" }}>¿Quién eres<br />en el parche?</div>
          <p style={{ font: "400 14.5px/1.5 var(--font-sans)", color: "var(--color-tenue)", margin: "9px 0 0" }}>
            Escoge un animal. Se puede cambiar cuando quieras — y no hay fotos, así que nadie sale mal.
          </p>
        </div>
        {errorLine}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <AvatarPicker value={avatar} onSelect={setAvatar} />
        </div>
        <div style={{ padding: "14px 0 calc(env(safe-area-inset-bottom,0px) + 20px)" }}>
          <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={finishPassword} disabled={pending}>
            {pending ? "Creando cuenta…" : "Listo, entrar"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- PASO 4 · oferta de correo de recuperación (tras passkey) ----------
  return <RecoveryOffer />;
}

/** Se muestra tras registrar la passkey. La sesión ya está activa. */
function RecoveryOffer() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function go() {
    window.location.assign("/");
  }
  async function save() {
    setError(null);
    setSaving(true);
    const res = await addRecoveryEmail(email);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    go();
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "calc(24px + env(safe-area-inset-top)) 26px calc(env(safe-area-inset-bottom,0px) + 20px)", gap: 20 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>✉️</div>
        <div style={{ font: "800 28px/1.1 var(--font-display)", letterSpacing: "-.02em" }}>¿Y si cambias<br />de teléfono?</div>
        <p style={{ font: "400 15px/1.5 var(--font-sans)", color: "var(--color-tenue)", margin: 0 }}>
          Tu passkey vive en este dispositivo. Agrega un correo (opcional) para recuperar tu cuenta si lo pierdes o cambias de teléfono.
        </p>
        <input className="field" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 14px var(--font-sans)", margin: 0 }}>{error}</p>}
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={save} disabled={saving || !email.trim()}>
          {saving ? "Guardando…" : "Guardar y entrar"}
        </button>
        <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 52 }} onClick={go} disabled={saving}>
          Ahora no
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { AvatarPicker } from "@/components/AvatarPicker";
import { registerWithInvite, validateInviteCode } from "@/app/actions/auth";

function Progress({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {[1, 2, 3].map((n) => (
        <span key={n} style={{ height: 5, flex: 1, borderRadius: 99, background: n <= step ? "var(--color-ambar)" : "var(--color-borde)" }} />
      ))}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", font: "500 13px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 };

export function RegisterWizard({ initialCode = "" }: { initialCode?: string }) {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, start] = useTransition();

  // Item A.1-3: validar el código al pasar del paso 1 al 2 (no crea cuenta).
  async function next1() {
    setError(null);
    if (!code.trim()) return setError("Escribe tu código de invitación");
    setChecking(true);
    const res = await validateInviteCode(code.trim());
    setChecking(false);
    if (!res.ok) return setError(res.error);
    setStep(2);
  }
  function next2() {
    setError(null);
    if (!name.trim()) return setError("Pon tu nombre");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Email inválido");
    if (password.length < 8) return setError("La contraseña necesita mínimo 8 caracteres");
    setStep(3);
  }
  function finish() {
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
          <Progress step={1} />
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

  if (step === 2) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "calc(16px + env(safe-area-inset-top)) 26px 0", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{backBtn(() => setStep(1))}<span style={{ font: "800 21px var(--font-display)", letterSpacing: "-.02em" }}>Tus datos</span></div>
        <Progress step={2} />
        {errorLine}
        <div style={{ display: "grid", gap: 14 }}>
          <div><label style={labelStyle} htmlFor="name">Tu nombre</label><input id="name" className="field" placeholder="Como te dicen" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label style={labelStyle} htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div>
            <label style={labelStyle} htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue-2)", margin: "6px 0 0" }}>Mínimo 8 caracteres.</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={next2}>Continuar</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "calc(16px + env(safe-area-inset-top)) 26px 0", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{backBtn(() => setStep(2))}</div>
      <Progress step={3} />
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
        <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={finish} disabled={pending}>
          {pending ? "Creando cuenta…" : "Listo, entrar"}
        </button>
      </div>
    </div>
  );
}

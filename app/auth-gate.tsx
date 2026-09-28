"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import Finance from "./finance";
import { activateSavedAccount, authenticatedFetch, forgetSavedAccount, getSavedAccounts, rememberAccountSession, setRememberSession, supabase, type SavedMizufiAccount } from "./supabase-client";
import type { BetaStats, FinanceSpace } from "./finance-store";

type AccountContext = {
  displayName: string;
  isBetaAdmin: boolean;
  betaStats?: BetaStats;
  plan: "free" | "vip";
  vipActive: boolean;
  vipRemaining: number;
  spaces: FinanceSpace[];
};

type AuthMode = "login" | "register" | "forgot" | "reset" | "verify";

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <span className="auth-password-field">
        <input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={minLength}
          required
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.8 10.8 0 0 1 12 4c5.3 0 8.8 4.8 9 5.1a1.5 1.5 0 0 1 0 1.8 14.4 14.4 0 0 1-2.2 2.6M6.6 6.6A15.5 15.5 0 0 0 3 10s3.5 6 9 6a10 10 0 0 0 3.4-.6" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.7 10.9a1.6 1.6 0 0 1 0-1.8C4 7.2 7.2 4 12 4s8 3.2 9.3 5.1a1.6 1.6 0 0 1 0 1.8C20 12.8 16.8 16 12 16s-8-3.2-9.3-5.1Z" /><circle cx="12" cy="10" r="2.5" /></svg>
          )}
        </button>
      </span>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function friendlyError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "El correo o la contraseña no son correctos.";
  if (normalized.includes("email not confirmed")) return "Todavía falta confirmar tu correo. Pulsa «No me ha llegado el correo» para recibir un enlace nuevo.";
  if (normalized.includes("user already registered")) return "Ya existe una cuenta con este correo.";
  if (normalized.includes("password should be")) return "La contraseña debe tener al menos 8 caracteres.";
  if (normalized.includes("email rate limit")) return "Se han enviado demasiados correos. Espera unos minutos e inténtalo de nuevo.";
  return "No hemos podido completar la operación. Inténtalo de nuevo.";
}

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<AccountContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [activeSpaceId, setActiveSpaceId] = useState("");
  const [savedAccounts, setSavedAccounts] = useState<SavedMizufiAccount[]>([]);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addAccountEmail, setAddAccountEmail] = useState("");
  const [addAccountPassword, setAddAccountPassword] = useState("");
  const [addAccountBusy, setAddAccountBusy] = useState(false);
  const [addAccountError, setAddAccountError] = useState("");

  const refreshAccount = useCallback(async () => {
    const response = await authenticatedFetch("/api/session");
    if (!response.ok) throw new Error("No se ha podido abrir la cuenta");
    const next = await response.json() as AccountContext;
    setAccount(next);
    setLoading(false);
    setActiveSpaceId((current) => {
      const storageKey = user ? `mizufi-active-space:${user.id}` : "";
      const remembered = storageKey ? window.localStorage.getItem(storageKey) : null;
      const selected = [current, remembered].find((id) => id && next.spaces.some((space) => space.id === id)) ?? next.spaces[0]?.id ?? "";
      if (storageKey && selected) window.localStorage.setItem(storageKey, selected);
      return selected;
    });
    return next;
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) rememberAccountSession(data.session);
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setSavedAccounts(getSavedAccounts());
      setLoading(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession) rememberAccountSession(nextSession);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setMode("reset");
      if (!nextSession) setAccount(null);
      setSavedAccounts(getSavedAccounts());
      setLoading(!!nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshAccount()
      .catch(() => {
        setError("No hemos podido abrir tu espacio. Inténtalo de nuevo.");
        setAccount(null);
        setLoading(false);
      });
  }, [session]);

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  const changeMode = (next: AuthMode) => {
    clearMessages();
    setPassword("");
    setConfirmPassword("");
    setMode(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();
    if ((mode === "register" || mode === "reset") && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if ((mode === "register" || mode === "reset") && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "login") {
        setRememberSession(rememberMe);
        const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (authError) throw authError;
      } else if (mode === "register") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (authError) throw authError;
        if (data.user && data.user.identities?.length === 0) {
          setError("Ya existe una cuenta con este correo. Prueba a iniciar sesión o a recuperar la contraseña.");
          return;
        }
        if (!data.session) {
          setNotice("Te hemos enviado un correo. Ábrelo para confirmar tu cuenta y después inicia sesión. Si no lo encuentras, revisa la carpeta de spam.");
          setMode("login");
          setPassword("");
          setConfirmPassword("");
        }
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: window.location.origin,
        });
        if (authError) throw authError;
        setNotice("Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Si no lo encuentras, revisa la carpeta de spam.");
      } else if (mode === "verify") {
        const { error: authError } = await supabase.auth.resend({
          type: "signup",
          email: normalizedEmail,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        setNotice("Correo de verificación reenviado. Puede tardar unos minutos; revisa también spam y Promociones.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setNotice("Contraseña actualizada correctamente.");
        setMode("login");
      }
    } catch (authError) {
      setError(friendlyError(authError instanceof Error ? authError.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (user) forgetSavedAccount(user.id);
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setUser(null);
    setAccount(null);
    changeMode("login");
  };

  const switchAccount = async (userId: string) => {
    if (userId === user?.id) return;
    const previousAccount = account;
    setLoading(true);
    setAccount(null);
    try {
      const next = await activateSavedAccount(userId);
      setSession(next);
      setUser(next.user);
      setSavedAccounts(getSavedAccounts());
    } catch {
      setError("La sesión guardada ha caducado. Inicia sesión de nuevo con esa cuenta.");
      setSavedAccounts(getSavedAccounts());
      if (session) setAccount(previousAccount);
      setLoading(false);
    }
  };

  const addAnotherAccount = async (event: FormEvent) => {
    event.preventDefault();
    setAddAccountBusy(true);
    setAddAccountError("");
    const previousAccount = account;
    try {
      if (session) rememberAccountSession(session);
      setRememberSession(true);
      setLoading(true);
      setAccount(null);
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: addAccountEmail.trim().toLowerCase(),
        password: addAccountPassword,
      });
      if (authError || !data.session) throw authError ?? new Error("No se ha podido iniciar sesión");
      rememberAccountSession(data.session);
      setSavedAccounts(getSavedAccounts());
      setAddAccountOpen(false);
      setAddAccountEmail("");
      setAddAccountPassword("");
    } catch (authError) {
      setAddAccountError(friendlyError(authError instanceof Error ? authError.message : ""));
      setAccount(previousAccount);
      setLoading(false);
    } finally {
      setAddAccountBusy(false);
    }
  };

  const switchSpace = (spaceId: string) => {
    if (!account?.spaces.some((space) => space.id === spaceId)) return;
    if (user) window.localStorage.setItem(`mizufi-active-space:${user.id}`, spaceId);
    setActiveSpaceId(spaceId);
  };

  if (loading || (session && !account && mode !== "reset")) {
    return <main className="auth-page"><div className="auth-loading" role="status"><img src="/mizufi-logo-ola-mar.png" alt="" /><span>Cargando…</span></div></main>;
  }

  if (session && user && account && mode !== "reset") {
    return (
      <><Finance
        key={activeSpaceId}
        email={user.email ?? ""}
        displayName={account.displayName}
        isBetaAdmin={account.isBetaAdmin}
        betaStats={account.betaStats}
        plan={account.plan}
        vipActive={account.vipActive}
        vipRemaining={account.vipRemaining}
        onRefreshAccount={refreshAccount}
        onSignOut={signOut}
        spaces={account.spaces}
        activeSpaceId={activeSpaceId || account.spaces[0]?.id || ""}
        onSwitchSpace={switchSpace}
        savedAccounts={savedAccounts.map(({ userId, email }) => ({ userId, email }))}
        currentUserId={user.id}
        onSwitchAccount={switchAccount}
        onForgetAccount={(userId) => { forgetSavedAccount(userId); setSavedAccounts(getSavedAccounts()); }}
        onAddAccount={() => { setAddAccountError(""); setAddAccountEmail(""); setAddAccountPassword(""); setAddAccountOpen(true); }}
      />
      {addAccountOpen && <div className="account-login-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddAccountOpen(false); }}>
        <section className="account-login-dialog" role="dialog" aria-modal="true" aria-labelledby="add-account-title">
          <header><div><p>AÑADIR USUARIO</p><h2 id="add-account-title">Otra cuenta de MiZUFi</h2></div><button type="button" onClick={() => setAddAccountOpen(false)} aria-label="Cerrar">×</button></header>
          <p>Inicia sesión una vez. Después podrás cambiar de usuario desde tu foto sin volver a escribir la contraseña en este dispositivo.</p>
          <form onSubmit={addAnotherAccount}>
            <label>Correo electrónico<input type="email" autoComplete="email" value={addAccountEmail} onChange={(event) => setAddAccountEmail(event.target.value)} required /></label>
            <PasswordField label="Contraseña" autoComplete="current-password" value={addAccountPassword} onChange={setAddAccountPassword} />
            {addAccountError && <p className="auth-message auth-error" role="alert">{addAccountError}</p>}
            <button type="submit" className="auth-primary" disabled={addAccountBusy}>{addAccountBusy ? "Abriendo…" : "Añadir cuenta"}</button>
          </form>
          <small>La sesión se guardará únicamente en este dispositivo. No utilices esta opción en un móvil u ordenador ajeno.</small>
        </section>
      </div>}</>
    );
  }

  return (
    <main className="auth-page" data-access-build="2026-09-16">
      <section className="auth-card" aria-labelledby="auth-title">
        <img src="/mizufi-logo-ola-mar.png" alt="MiZUFi" className="auth-logo" />
        <div className="auth-copy">
          <p className="auth-eyebrow">Controla la marea de tus finanzas</p>
          <h1 id="auth-title">
            {mode === "register" ? "Crea tu cuenta" : mode === "forgot" ? "Recupera tu acceso" : mode === "verify" ? "Confirma tu correo" : mode === "reset" ? "Nueva contraseña" : "Hola de nuevo"}
          </h1>
          <p>
            {mode === "register" ? "Empieza a anticipar lo que viene y decide con calma." : mode === "forgot" ? "Te enviaremos un enlace para volver a entrar." : mode === "verify" ? "Escribe el correo con el que te registraste y te enviaremos otro enlace." : mode === "reset" ? "Elige una contraseña nueva para tu cuenta." : "Entra para ver tus cuentas, movimientos y previsiones."}
          </p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && <label>Nombre<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>}
          {mode !== "reset" && <label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
          {mode !== "forgot" && mode !== "verify" && <PasswordField label="Contraseña" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={setPassword} minLength={mode === "login" ? undefined : 8} />}
          {mode === "login" && <label className="auth-remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Recordarme en este dispositivo</span></label>}
          {(mode === "register" || mode === "reset") && <PasswordField label="Repite la contraseña" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} minLength={8} hint="Mínimo 8 caracteres" />}
          {error && <p className="auth-message auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-message auth-notice">{notice}</p>}
          <button type="submit" className="auth-primary" disabled={busy}>{busy ? "Un momento…" : mode === "register" ? "Crear cuenta" : mode === "forgot" ? "Enviar enlace" : mode === "verify" ? "Reenviar verificación" : mode === "reset" ? "Guardar contraseña" : "Iniciar sesión"}</button>
        </form>
        {mode === "login" && savedAccounts.length > 0 && <div className="saved-account-login"><span>CUENTAS GUARDADAS EN ESTE DISPOSITIVO</span>{savedAccounts.map((saved) => <div key={saved.userId}><button type="button" onClick={() => void switchAccount(saved.userId)}><b>{saved.email.slice(0, 1).toUpperCase()}</b><span>{saved.email}</span></button><button type="button" aria-label={`Quitar ${saved.email} de este dispositivo`} onClick={() => { if (window.confirm(`¿Seguro que quieres quitar ${saved.email} de este dispositivo? La cuenta y sus datos no se borrarán.`)) { forgetSavedAccount(saved.userId); setSavedAccounts(getSavedAccounts()); } }}>×</button></div>)}</div>}
        <div className="auth-actions">
          {mode === "login" && <><button type="button" onClick={() => changeMode("forgot")}>He olvidado mi contraseña</button><button type="button" onClick={() => changeMode("verify")}>No me ha llegado el correo de verificación</button><p>¿Primera vez en MiZUFi? <button type="button" onClick={() => changeMode("register")}>Crear cuenta</button></p></>}
          {mode !== "login" && <button type="button" onClick={() => changeMode("login")}>← Volver a iniciar sesión</button>}
        </div>
        <p className="auth-legal">Tus datos financieros son privados y se guardan asociados únicamente a tu cuenta.</p>
      </section>
    </main>
  );
}

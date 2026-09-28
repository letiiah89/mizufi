"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "mizufi-pwa-dismissed-at";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export default function PwaInstaller() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstagram, setIsInstagram] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js?v=16", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const agent = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(agent);
    const instagram = /Instagram/i.test(agent);
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);

    setInstalled(standalone);
    setIsIos(ios);
    setIsInstagram(instagram);
    setVisible(!standalone && Date.now() - dismissedAt > WEEK && (ios || instagram));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setPromptEvent(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible || installed) return null;

  return (
    <aside className="pwa-install" aria-label="Instalar MiZUFi">
      <img src="/icons/ola-icon-192.png" alt="" aria-hidden="true" />
      <div className="pwa-install-copy">
        <strong>Lleva MiZUFi contigo</strong>
        <p>
          {isInstagram
            ? "Abre esta página en Safari o Chrome para instalarla."
            : "Instálala en tu dispositivo y ábrela como una app."}
        </p>
        {showHelp && (
          <p className="pwa-install-help">
            {isIos
              ? "Pulsa Compartir y después «Añadir a pantalla de inicio»."
              : "Abre el menú del navegador y elige «Instalar aplicación»."}
          </p>
        )}
        <div className="pwa-install-actions">
          {!isInstagram && <button type="button" onClick={install}>{promptEvent ? "Instalar" : "Ver cómo"}</button>}
          <button type="button" className="pwa-install-later" onClick={dismiss}>Ahora no</button>
        </div>
      </div>
      <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Cerrar">×</button>
    </aside>
  );
}

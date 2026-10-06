"use client";

import { useEffect, useState } from "react";

import { trpc } from "@/trpc/react";
import { Switch } from "@/components/switch";
import { SettingsSection } from "@/components/settings/form";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** The browser wants the public key as bytes, not base64url text. */
function keyToBytes(base64Url: string) {
  const padded = base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Support = "checking" | "supported" | "needs-install" | "unsupported";

export default function NotificationsSettingsPage() {
  const utils = trpc.useUtils();
  const { data: status } = trpc.notification.status.useQuery();
  const subscribe = trpc.notification.subscribe.useMutation({ onSuccess: () => utils.notification.status.invalidate() });
  const unsubscribe = trpc.notification.unsubscribe.useMutation({ onSuccess: () => utils.notification.status.invalidate() });
  const sendTest = trpc.notification.sendTest.useMutation();

  const [support, setSupport] = useState<Support>("checking");
  const [thisDevice, setThisDevice] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "n/a">("n/a");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Capability checks run in the browser only.
    /* eslint-disable react-hooks/set-state-in-effect */
    const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!hasPush) {
      // On an iPhone the push APIs only exist once the app is opened from the Home Screen.
      setSupport(isIos && !standalone ? "needs-install" : "unsupported");
      return;
    }
    setSupport("supported");
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setThisDevice(!!sub));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage("Notifications are blocked for Homebase. Allow them in your phone's settings, then try again.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }));
      const json = sub.toJSON();
      await subscribe.mutateAsync({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 280),
      });
      setThisDevice(true);
    } catch {
      setMessage("Couldn't switch notifications on for this device. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribe.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setThisDevice(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsSection title="Reminder notifications">
        <p className="-mt-2 text-[13px] text-text-muted">
          You get one message a day at 10:00 listing the reminders that are due for you, and one gentle nudge when
          something is 2 days overdue. After that it stays red in the app, but doesn&apos;t notify again.
        </p>

        {status && !status.configured && (
          <p className="rounded-xl border border-critical/30 bg-critical/10 px-3.5 py-2.5 text-[13px] text-critical">
            Notifications aren&apos;t set up on this server yet.
          </p>
        )}

        {support === "needs-install" && (
          <div className="rounded-2xl border border-border-soft p-4 text-[13.5px]">
            <p className="mb-2 font-semibold">First add Homebase to your Home Screen</p>
            <ol className="list-decimal space-y-1 pl-5 text-text-muted">
              <li>Open Homebase in Safari on your iPhone.</li>
              <li>Tap the Share button, then <b className="text-text">Add to Home Screen</b>.</li>
              <li>Open Homebase from the Home Screen icon, come back to this page and switch notifications on.</li>
            </ol>
          </div>
        )}

        {support === "unsupported" && (
          <p className="text-[13.5px] text-text-muted">This browser can&apos;t receive notifications.</p>
        )}

        {support === "supported" && (
          <div className="flex items-center gap-4 rounded-2xl border border-border-soft p-4">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">Notifications on this device</div>
              <div className="text-[12.5px] text-text-muted">
                {permission === "denied"
                  ? "Blocked — allow notifications for Homebase in your device settings."
                  : thisDevice
                    ? "On — this device will get your reminders."
                    : "Off"}
              </div>
            </div>
            <Switch
              label="Notifications on this device"
              checked={thisDevice}
              disabled={busy || !status?.configured || permission === "denied"}
              onChange={(on) => (on ? turnOn() : turnOff())}
            />
          </div>
        )}

        {message && <p className="text-[13px] text-critical">{message}</p>}

        {status && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => sendTest.mutate()}
              disabled={sendTest.isPending || status.devices === 0}
              className="self-start rounded-xl border border-border px-5 py-2.5 text-[13.5px] font-medium hover:bg-surface-hover disabled:text-text-faint disabled:hover:bg-transparent"
            >
              {sendTest.isPending ? "Sending…" : "Send me a test notification"}
            </button>
            <p className="text-[12.5px] text-text-muted">
              {status.devices === 0
                ? "No device has notifications on yet."
                : `${status.devices} device${status.devices === 1 ? "" : "s"} will get your reminders.`}
              {sendTest.data && (sendTest.data.sent > 0 ? " Test sent — check your phone." : " It didn't reach any device.")}
            </p>
          </div>
        )}
      </SettingsSection>
    </>
  );
}

import { useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';
import { formatTime } from '../../utils/helpers';

const checklistLabels = [
  { key: 'explainedScreenSharing', label: 'Screen sharing explained during setup' },
  { key: 'accessibilityServiceEnabled', label: 'Remote support explained' },
  { key: 'notificationPermissionGranted', label: 'Notifications allowed' },
  { key: 'whatsAppInstalled', label: 'WhatsApp sharing available' },
] as const;

export function ParentRemoteHelpScreen() {
  const {
    currentUser,
    selectedParent,
    getRemoteSetup,
    getTrustedRemoteContacts,
    getActiveRemoteSession,
    startRemoteHelpSession,
    enableScreenShareForSession,
    disableScreenShareForSession,
    respondToRemoteControl,
    disableRemoteControlForSession,
    stopRemoteHelpSession,
  } = useApp();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  if (!selectedParent || !currentUser) return null;

  const setup = getRemoteSetup();
  const contacts = getTrustedRemoteContacts().filter(
    (contact) => contact.whatsAppVerified,
  );
  const activeSession = getActiveRemoteSession(currentUser.id);
  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) ?? null;
  const activeContact =
    contacts.find((contact) => contact.id === activeSession?.childContactId) ?? selectedContact;

  const isSetupComplete = !!setup && Object.values(setup.checklist).every(Boolean);

  const openWhatsApp = () => {
    if (!activeSession) return;

    const contact = contacts.find((entry) => entry.id === activeSession.childContactId);
    if (!contact) return;

    const cleanPhone = contact.phoneNumber.replace(/[^\d]/g, '');
    const message = `I need help. Open your ElderCare app and join my remote help session with code: ${activeSession.sessionCode}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`space-y-6 ${activeSession ? 'pb-44' : ''}`}>
      <section className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Remote Help
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-800">Share your screen safely</h2>
      </section>

      {!isSetupComplete ? (
        <section className="space-y-4 rounded-[28px] border border-amber-200 bg-amber-50 p-5">
          <div>
            <h3 className="text-xl font-bold text-amber-900">Child setup still needed</h3>
            <p className="mt-2 text-sm text-amber-800">
              A child should finish first-time setup in Child Settings before you use remote help.
            </p>
          </div>
          <div className="space-y-2">
            {checklistLabels.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 text-sm"
              >
                <span className="text-slate-700">{item.label}</span>
                <span className={setup?.checklist[item.key] ? 'text-emerald-700' : 'text-rose-600'}>
                  {setup?.checklist[item.key] ? 'Done' : 'Needed'}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isSetupComplete && !activeSession ? (
        <section className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <h3 className="text-2xl font-bold text-slate-800">Choose Child</h3>
            <div className="mt-4 grid gap-3">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    setSelectedContactId(contact.id);
                    startRemoteHelpSession(currentUser.id, currentUser.name, contact.id);
                  }}
                  className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
                >
                  <p className="text-xl font-bold text-slate-800">{contact.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Linked child account
                  </p>
                  <p className="mt-3 text-sm font-medium text-teal-700">{contact.phoneNumber}</p>
                </button>
              ))}
            </div>
          </div>
          {contacts.length === 0 ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              No linked child accounts with phone numbers are ready yet.
            </p>
          ) : null}
        </section>
      ) : null}

      {activeSession ? (
        <section className="space-y-4">
          <div className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
                  Help Session
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-800">
                  {activeContact?.name ?? 'Linked child'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {formatTime(activeSession.expiresAt)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right text-sm text-slate-600">
                <p>Screen demo is {activeSession.screenShareOn ? 'ON' : 'OFF'}</p>
                <p>Control demo is {activeSession.remoteControlOn ? 'ON' : 'OFF'}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Code
                </p>
                <p className="mt-2 break-all text-3xl font-black tracking-[0.18em] text-slate-900">
                  {activeSession.sessionCode}
                </p>
              </div>
              <button
                type="button"
                onClick={openWhatsApp}
                className="shrink-0 rounded-2xl bg-emerald-600 px-5 py-4 text-lg font-bold text-white shadow-sm"
              >
                Send
              </button>
            </div>

            {activeSession.status === 'control_requested' ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xl font-bold text-amber-900">
                  Allow{' '}
                  {activeContact?.name ?? 'your child'}{' '}
                  to help control your phone?
                </p>
                <button
                  type="button"
                  onClick={() => respondToRemoteControl(activeSession.id, false)}
                  className="mt-4 rounded-2xl bg-white px-5 py-3 text-base font-semibold text-slate-700"
                >
                  No
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeSession ? (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg border-t border-slate-200 bg-white/98 p-4 shadow-[0_-12px_32px_rgba(15,23,42,0.16)] backdrop-blur safe-area-bottom">
          <div className="grid grid-cols-3 gap-2">
            <BigButton
              variant={activeSession.mediaProjectionApproved ? 'success' : 'secondary'}
              onClick={() =>
                activeSession.mediaProjectionApproved
                  ? disableScreenShareForSession(activeSession.id)
                  : enableScreenShareForSession(activeSession.id)
              }
              className="!rounded-[22px] !px-3 !py-4"
              labelClassName="text-sm leading-tight"
            >
              Screen Share
            </BigButton>
            <BigButton
              variant={activeSession.remoteControlOn ? 'success' : 'secondary'}
              onClick={() =>
                activeSession.remoteControlOn
                  ? disableRemoteControlForSession(activeSession.id)
                  : respondToRemoteControl(activeSession.id, true)
              }
              disabled={!activeSession.screenShareOn}
              className="!rounded-[22px] !px-3 !py-4"
              labelClassName="text-sm leading-tight"
            >
              Remote Control
            </BigButton>
            <BigButton
              variant="danger"
              onClick={() => stopRemoteHelpSession(activeSession.id, 'parent_stopped')}
              className="!rounded-[22px] !px-3 !py-4"
              labelClassName="text-sm leading-tight"
            >
              Stop
            </BigButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParentSwitcher } from '../../components/ParentSwitcher';
import { useApp } from '../../context/AppContext';
import type { EmergencyStep, RemoteSetupChecklist } from '../../types';

const actionOptions: { value: EmergencyStep['action']; label: string }[] = [
  { value: 'notify_child', label: 'Notify children' },
  { value: 'call_contact', label: 'Call contact' },
  { value: 'call_ambulance', label: 'Call ambulance' },
  { value: 'share_location', label: 'Share location' },
];

export function ChildSettings() {
  const navigate = useNavigate();
  const {
    currentUser,
    resetDemo,
    selectedParent,
    state,
    updateEmergencyRoutine,
    getRemoteSetup,
    saveRemoteSetup,
  } = useApp();
  const routine = state.emergencyRoutines.find(
    (entry) => entry.parentId === selectedParent?.id,
  );
  const [steps, setSteps] = useState<EmergencyStep[]>(
    routine?.steps ?? [{ order: 1, action: 'notify_child' }],
  );

  useEffect(() => {
    setSteps(routine?.steps ?? [{ order: 1, action: 'notify_child' }]);
  }, [routine]);

  const baseChecklist: RemoteSetupChecklist = useMemo(
    () => ({
      explainedScreenSharing: false,
      accessibilityServiceEnabled: false,
      notificationPermissionGranted: false,
      whatsAppInstalled: false,
    }),
    [],
  );

  const initialRemoteSetup = useMemo(
    () => getRemoteSetup() ?? null,
    [getRemoteSetup],
  );
  const [checklist, setChecklist] = useState<RemoteSetupChecklist>(
    initialRemoteSetup?.checklist ?? baseChecklist,
  );

  useEffect(() => {
    const remoteSetup = getRemoteSetup();
    setChecklist(remoteSetup?.checklist ?? baseChecklist);
  }, [baseChecklist, getRemoteSetup]);

  if (!selectedParent) return null;

  const isRemoteSetupComplete = Object.values(checklist).every(Boolean);

  const saveRoutine = () => {
    updateEmergencyRoutine({
      parentId: selectedParent.id,
      steps: steps.map((step, index) => ({ ...step, order: index + 1 })),
    });
    alert('Emergency routine saved.');
  };

  const updateStep = (index: number, patch: Partial<EmergencyStep>) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const saveRemoteHelpSetup = () => {
    saveRemoteSetup({
      ownerUserId: selectedParent.id,
      configuredByUserId: currentUser?.id,
      checklist,
      trustedContacts: [],
      completedAt: isRemoteSetupComplete ? new Date().toISOString() : undefined,
    });
    navigate('/child/remote-support/join');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Family Settings</h2>

      <section className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-bold text-slate-800">Prototype setup mode</h3>
            <p className="mt-2 text-sm text-slate-500">
              Mark the browser demo steps complete so the parent can explore remote help without
              real device permissions.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isRemoteSetupComplete
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isRemoteSetupComplete ? 'Setup complete' : 'Needs setup'}
          </span>
        </div>

        <div className="space-y-3">
          {[
            ['explainedScreenSharing', 'Screen sharing permission explained'],
            ['accessibilityServiceEnabled', 'Remote support explained'],
            ['notificationPermissionGranted', 'Notification permission granted'],
            ['whatsAppInstalled', 'WhatsApp sharing available'],
          ].map(([key, label]) => {
            const itemKey = key as keyof RemoteSetupChecklist;
            return (
              <button
                key={itemKey}
                type="button"
                onClick={() =>
                  setChecklist((current) => ({
                    ...current,
                    [itemKey]: !current[itemKey],
                  }))
                }
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left ${
                  checklist[itemKey]
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <span className={checklist[itemKey] ? 'text-emerald-700' : 'text-slate-400'}>
                  {checklist[itemKey] ? 'Done' : 'Mark done'}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={saveRemoteHelpSetup}
          className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white"
        >
          Open remote support demo
        </button>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <ParentSwitcher />
        <h3 className="font-semibold text-slate-700">Emergency routine</h3>
        <p className="text-sm text-slate-500">
          Steps shown to {selectedParent.name} when they tap Help.
        </p>

        {steps.map((step, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-slate-100 p-3">
            <p className="text-xs font-medium text-teal-600">Step {index + 1}</p>
            <select
              value={step.action}
              onChange={(e) =>
                updateStep(index, {
                  action: e.target.value as EmergencyStep['action'],
                })
              }
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              {actionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {step.action === 'call_contact' && (
              <>
                <input
                  placeholder="Contact name"
                  value={step.contactName ?? ''}
                  onChange={(e) => updateStep(index, { contactName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="Phone (+91...)"
                  value={step.contactPhone ?? ''}
                  onChange={(e) => updateStep(index, { contactPhone: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </>
            )}
            {steps.length > 1 && (
              <button
                type="button"
                onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                className="text-xs text-rose-500"
              >
                Remove step
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setSteps((current) => [
              ...current,
              { order: current.length + 1, action: 'notify_child' },
            ])
          }
          className="text-sm text-teal-600 underline"
        >
          + Add step
        </button>
        <button
          type="button"
          onClick={saveRoutine}
          className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white"
        >
          Save routine
        </button>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-700">Demo data</h3>
        <button
          type="button"
          onClick={() => {
            if (confirm('Reset all demo data?')) resetDemo();
          }}
          className="mt-2 text-sm text-rose-600 underline"
        >
          Reset to sample data
        </button>
      </section>

      <section className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
        <p>
          <strong>PWA:</strong> Install via browser menu - Add to Home Screen
        </p>
        <p className="mt-2">
          <strong>Prototype:</strong> Screen sharing and remote control are simulated in the browser.
        </p>
      </section>
    </div>
  );
}

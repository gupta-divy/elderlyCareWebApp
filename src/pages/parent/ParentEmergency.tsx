import { useMemo, useState } from 'react';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';
import type { EmergencyStep } from '../../types';

const actionLabels: Record<EmergencyStep['action'], string> = {
  notify_child: 'Notify family members',
  call_contact: 'Call emergency contact',
  call_ambulance: 'Call ambulance (108)',
  share_location: 'Share your location',
};

export function ParentEmergency() {
  const { selectedParent, state } = useApp();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const parent = selectedParent;
  if (!parent) return null;

  const routine = state.emergencyRoutines.find((entry) => entry.parentId === parent.id);
  const steps = useMemo(
    () => [...(routine?.steps ?? [])].sort((a, b) => a.order - b.order),
    [routine],
  );

  const runStep = (step: EmergencyStep) => {
    switch (step.action) {
      case 'notify_child':
        alert('Your family has been notified. Help is on the way.');
        break;
      case 'call_contact':
        if (step.contactPhone) window.location.href = `tel:${step.contactPhone}`;
        break;
      case 'call_ambulance':
        window.location.href = 'tel:108';
        break;
      case 'share_location':
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
              navigator.clipboard?.writeText(url);
              alert('Location copied. Share it with your family.');
            },
            () => alert('Could not get location. Please call family.'),
          );
        } else {
          alert('Location not available. Please call family.');
        }
        break;
    }
  };

  const startEmergency = () => {
    setActive(true);
    setStepIndex(0);
    if (steps[0]) runStep(steps[0]);
  };

  const nextStep = () => {
    const next = stepIndex + 1;
    if (next < steps.length) {
      setStepIndex(next);
      runStep(steps[next]);
    } else {
      setActive(false);
      setStepIndex(0);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4">
        <h2 className="text-2xl font-bold text-rose-800">Emergency Help</h2>
        <p className="mt-2 text-lg text-rose-700">
          Press the big red button if you need help right now.
        </p>
      </section>

      {!active ? (
        <BigButton variant="danger" icon="SOS" onClick={startEmergency}>
          HELP ME NOW
        </BigButton>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-md">
            <p className="text-sm text-slate-500">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <p className="mt-2 text-xl font-bold">
              {actionLabels[steps[stepIndex]?.action ?? 'notify_child']}
            </p>
            {steps[stepIndex]?.contactName && (
              <p className="text-lg text-slate-600">{steps[stepIndex].contactName}</p>
            )}
          </div>
          <BigButton onClick={nextStep}>
            {stepIndex + 1 < steps.length ? 'Next Step' : 'Done'}
          </BigButton>
          <button
            type="button"
            className="w-full text-center text-slate-500 underline"
            onClick={() => {
              setActive(false);
              setStepIndex(0);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-700">Your emergency plan</h3>
        <ol className="mt-3 space-y-2">
          {steps.map((step, index) => (
            <li key={step.order} className="flex gap-2 text-slate-600">
              <span className="font-bold text-teal-600">{index + 1}.</span>
              {actionLabels[step.action]}
              {step.contactName && ` - ${step.contactName}`}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

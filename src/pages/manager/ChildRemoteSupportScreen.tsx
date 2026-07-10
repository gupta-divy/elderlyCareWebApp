import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';
import { formatTime } from '../../utils/helpers';

export function ChildRemoteSupportScreen() {
  const {
    currentUser,
    getRemoteSessionsForChildUser,
    requestRemoteControl,
    stopRemoteHelpSession,
  } = useApp();
  const navigate = useNavigate();

  if (!currentUser) return null;

  const sessions = getRemoteSessionsForChildUser(currentUser.id);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Remote Support
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-800">Live view and guided control</h2>
        <p className="mt-2 text-sm text-slate-500">
          When a parent sends a WhatsApp session code, you can join this browser prototype and
          request a simulated control session only when they need it.
        </p>
      </section>

      {sessions.length === 0 ? (
        <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 text-sm text-slate-500">
          <p>
            No active help sessions right now. Once a parent shares their screen and sends a
            session code, you can join it from the screen-share code entry screen.
          </p>
          <button
            type="button"
            onClick={() => navigate('/child/remote-support/join')}
            className="w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white"
          >
            Enter session code
          </button>
        </section>
      ) : null}

      {sessions.map((session) => {
        const canRequestControl = session.screenShareOn && !session.remoteControlOn;

        return (
          <section
            key={session.id}
            className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{session.hostName}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Session expires at {formatTime(session.expiresAt)}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                  Code {session.sessionCode}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right text-sm text-slate-600">
                <p>Screen demo is {session.screenShareOn ? 'ON' : 'OFF'}</p>
                <p>Control demo is {session.remoteControlOn ? 'ON' : 'OFF'}</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-linear-to-br from-slate-900 via-slate-800 to-slate-700 p-4 text-white">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-300">
                <span>Live Screen Demo</span>
                <span>Browser Viewer</span>
              </div>
              <div className="mt-4 flex h-64 items-center justify-center rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.25),_transparent_45%),linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))]">
                <div className="max-w-xs text-center">
                  <p className="text-xl font-semibold">Live parent screen preview</p>
                  <p className="mt-2 text-sm text-slate-300">
                    This shareable prototype simulates the support view. Real screen streaming and
                    control would be integrated with a secure provider later.
                  </p>
                </div>
              </div>
            </div>

            {canRequestControl ? (
              <BigButton
                onClick={() => requestRemoteControl(session.id)}
                subtitle="Parent must approve every session before control turns on"
              >
                Request Control
              </BigButton>
            ) : null}

            {session.status === 'control_requested' ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Waiting for the parent to approve remote control.
              </p>
            ) : null}

            {session.remoteControlOn ? (
              <div className="space-y-3 rounded-[28px] border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-lg font-semibold text-emerald-900">Remote control is active</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-2xl bg-white px-4 py-4 text-left shadow-sm"
                  >
                    <p className="font-semibold text-slate-800">Tap</p>
                    <p className="mt-1 text-sm text-slate-500">Prototype tap action for the demo session</p>
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-white px-4 py-4 text-left shadow-sm"
                  >
                    <p className="font-semibold text-slate-800">Swipe</p>
                    <p className="mt-1 text-sm text-slate-500">Prototype swipe action for the demo session</p>
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-white px-4 py-4 text-left shadow-sm"
                  >
                    <p className="font-semibold text-slate-800">Back</p>
                    <p className="mt-1 text-sm text-slate-500">Prototype back action for the demo session</p>
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl bg-white px-4 py-4 text-left shadow-sm"
                  >
                    <p className="font-semibold text-slate-800">Text Input</p>
                    <p className="mt-1 text-sm text-slate-500">Prototype text action for the demo session</p>
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => stopRemoteHelpSession(session.id, 'network_disconnected')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
            >
              Simulate disconnect
            </button>
          </section>
        );
      })}
    </div>
  );
}

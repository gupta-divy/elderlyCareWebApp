import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import { useApp } from '../../context/AppContext';

export function ChildJoinScreenShareScreen() {
  const navigate = useNavigate();
  const { currentUser, joinRemoteHelpSessionByCode } = useApp();
  const [sessionCode, setSessionCode] = useState('');
  const [joinMessage, setJoinMessage] = useState('');

  if (!currentUser) return null;

  const handleJoin = () => {
    const joined = joinRemoteHelpSessionByCode(currentUser.id, sessionCode);

    if (joined) {
      setJoinMessage('');
      setSessionCode('');
      navigate('/child/remote-support');
      return;
    }

    setJoinMessage('Code not found, expired, or not assigned to this trusted child.');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Join Screen Share
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-800">Enter parent session code</h2>
        <p className="mt-2 text-sm text-slate-500">
          Type the code the parent shared with you to join their live screen share session inside
          the app.
        </p>
      </section>

      <section className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Session code</span>
          <input
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            placeholder="Enter 6-digit code"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-center text-2xl font-semibold tracking-[0.3em] text-slate-900 uppercase"
          />
        </label>

        <BigButton onClick={handleJoin} subtitle="Use the code shared by the parent on WhatsApp">
          Join screen share
        </BigButton>

        <button
          type="button"
          onClick={() => navigate('/child/settings')}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
        >
          Back to setup
        </button>

        {joinMessage ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{joinMessage}</p>
        ) : null}
      </section>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export function Login() {
  const { state, login, resetDemo } = useApp();
  const navigate = useNavigate();

  const handleLogin = (userId: string, role: 'child' | 'parent') => {
    login(userId);
    navigate(role === 'parent' ? '/parent' : '/child');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <span className="text-5xl" role="img" aria-label="heart">
          Care
        </span>
        <h1 className="mt-4 text-3xl font-bold text-teal-700">ElderCare Connect</h1>
        <p className="mt-2 text-slate-600">
          One family workspace for caring for parents from anywhere.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-center text-sm font-medium text-slate-500">
          Demo family - choose a profile
        </p>

        {state.users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => handleLogin(user.id, user.role)}
            className="w-full rounded-2xl border-2 border-teal-200 bg-white p-5 text-left shadow-sm transition hover:border-teal-500 hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                {user.role}
              </span>
              <div>
                <p className="text-lg font-semibold text-slate-800">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-teal-600">
                  {user.role === 'parent' ? 'Parent workflow' : 'Child workflow'}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={resetDemo}
        className="mt-8 text-center text-sm text-slate-400 underline"
      >
        Reset demo data
      </button>

      <p className="mt-6 text-center text-xs text-slate-400">
        Prototype · Data saved in your browser · PWA installable
      </p>
    </div>
  );
}

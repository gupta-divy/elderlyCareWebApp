import { Component, lazy, Suspense, useMemo, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { useAuth } from './contexts/AuthContext';
import { useFamily } from './contexts/FamilyContext';
import { useFeatureFlags, type FeatureKey } from './features/flags/featureFlags';
import { useNativeAppShell } from './platform/useNativeAppShell';
import { platformServices } from './platform';
import { getHomeRoute } from './lib/auth/routes';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { AccountTest } from './pages/AccountTest';
import { AccountSettings } from './pages/AccountSettings';
import { SharedNotesScreen } from './pages/SharedNotesScreen';
import { ParentHome } from './pages/parent/ParentHome';
import { ParentTasks } from './pages/parent/ParentTasks';
import { CreateContactScreen } from './pages/parent/CreateContactScreen';
import { SendPhotoScreen } from './pages/parent/SendPhotoScreen';
import { PhoneDiaryScreen } from './pages/parent/PhoneDiaryScreen';
import { ChildDashboard } from './pages/manager/ManagerDashboard';
import { ChildTaskCreate, ChildTasks } from './pages/manager/ManagerTasks';
import { SupabaseTest } from './pages/SupabaseTest';

const DocumentsScreen = lazy(() =>
  import('./pages/parent/DocumentsScreen').then((module) => ({ default: module.DocumentsScreen })),
);
const DocumentFolderScreen = lazy(() =>
  import('./pages/parent/DocumentFolderScreen').then((module) => ({ default: module.DocumentFolderScreen })),
);
const ChildDocuments = lazy(() =>
  import('./pages/manager/ManagerDocuments').then((module) => ({ default: module.ChildDocuments })),
);
const ChildDocumentFolderScreen = lazy(() =>
  import('./pages/manager/ManagerDocumentFolderScreen').then((module) => ({
    default: module.ChildDocumentFolderScreen,
  })),
);
const ParentRemoteHelpScreen = lazy(() =>
  import('./pages/parent/ParentRemoteHelpScreen').then((module) => ({
    default: module.ParentRemoteHelpScreen,
  })),
);
const ChildRemoteSupportScreen = lazy(() =>
  import('./pages/manager/ChildRemoteSupportScreen').then((module) => ({
    default: module.ChildRemoteSupportScreen,
  })),
);
const ChildJoinScreenShareScreen = lazy(() =>
  import('./pages/manager/ChildJoinScreenShareScreen').then((module) => ({
    default: module.ChildJoinScreenShareScreen,
  })),
);

const ROUTE_RESTORE_KEY = 'setu-route-restore';
const ROUTE_RESTORE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type RouteRestoreSnapshot = {
  path: string;
  backgroundedAt: number;
};

function isRestorableRoute(path: string, role: 'child' | 'parent' | null) {
  if (!role) return false;
  const prefix = role === 'parent' ? '/parent' : '/child';
  return path === prefix || path.startsWith(`${prefix}/`);
}

function readRecentRestoreRoute(role: 'child' | 'parent' | null) {
  if (!platformServices.platform.isNative) return null;

  try {
    const raw = localStorage.getItem(ROUTE_RESTORE_KEY);
    if (!raw) return null;

    const snapshot = JSON.parse(raw) as Partial<RouteRestoreSnapshot>;
    if (
      typeof snapshot.path !== 'string' ||
      typeof snapshot.backgroundedAt !== 'number' ||
      Date.now() - snapshot.backgroundedAt > ROUTE_RESTORE_MAX_AGE_MS ||
      !isRestorableRoute(snapshot.path, role)
    ) {
      localStorage.removeItem(ROUTE_RESTORE_KEY);
      return null;
    }

    localStorage.removeItem(ROUTE_RESTORE_KEY);
    return snapshot.path;
  } catch {
    localStorage.removeItem(ROUTE_RESTORE_KEY);
    return null;
  }
}

function LoadingScreen() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-6 text-center text-slate-600">
      Loading...
    </main>
  );
}

class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="rounded-[28px] border border-rose-100 bg-white/95 p-5 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-lg font-bold text-slate-800">This screen needs a refresh</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          The app could not open this screen cleanly.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            Reload
          </button>
        </div>
      </section>
    );
  }
}

function LazyScreen({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

function FeatureRoute({
  children,
  feature,
  redirectTo,
}: {
  children: ReactNode;
  feature: FeatureKey;
  redirectTo: string;
}) {
  const { isFeatureEnabled } = useFeatureFlags();

  if (!isFeatureEnabled(feature)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <LazyScreen>{children}</LazyScreen>;
}

function ProtectedRoute({
  children,
  role: requiredRole,
}: {
  children: ReactNode;
  role: 'child' | 'parent';
}) {
  const location = useLocation();
  const { isDemoMode, isHydrated } = useApp();
  const { loading: authLoading, user, signOut } = useAuth();
  const {
    loading: familyLoading,
    profile,
    currentMembership,
    role: currentRole,
    status,
    error,
    refreshFamily,
  } = useFamily();

  if (!isHydrated || authLoading || familyLoading) {
    return <LoadingScreen />;
  }

  if (isDemoMode && (!profile || !currentMembership || !currentRole)) {
    return <LoadingScreen />;
  }

  if (!user && !isDemoMode) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!profile || status === 'missing_membership') {
    return (
      <Navigate
        to="/signup"
        replace
        state={{ from: location, message: 'Please finish family setup to continue.' }}
      />
    );
  }

  if (status === 'invalid_family' || !currentMembership || !currentRole) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 text-center">
        <section className="rounded-[28px] bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <p className="text-lg font-bold text-slate-800">Family data needs a refresh</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {error ?? 'We could not verify your family workspace.'}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void refreshFamily()}
              className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (currentRole !== requiredRole) {
    return <Navigate to={getHomeRoute(currentRole)} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  useNativeAppShell();
  const location = useLocation();

  const { isDemoMode, isHydrated } = useApp();
  const { loading: authLoading, user } = useAuth();
  const { loading: familyLoading, profile, currentMembership, role } = useFamily();
  const loading =
    authLoading ||
    familyLoading ||
    (isDemoMode && (!profile || !currentMembership || !role));
  const homeRoute = getHomeRoute(role);
  const initialAuthenticatedRoute = useMemo(() => {
    if (location.pathname !== '/') return homeRoute;
    return readRecentRestoreRoute(role) ?? homeRoute;
  }, [homeRoute, location.pathname, role]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          !isHydrated || loading ? (
            <LoadingScreen />
          ) : (user || isDemoMode) && profile && currentMembership ? (
            <Navigate to={initialAuthenticatedRoute} replace />
          ) : user ? (
            <Navigate to="/signup" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/supabase-test" element={<SupabaseTest />} />
      <Route
        path="/account-test"
        element={
          <ProtectedRoute role={role ?? 'child'}>
            {import.meta.env.DEV && role ? (
              <Layout />
            ) : (
              <Navigate to={role ? getHomeRoute(role) : '/login'} replace />
            )}
          </ProtectedRoute>
        }
      >
        <Route index element={<AccountTest />} />
      </Route>
      <Route
        path="/parent/send-photo"
        element={
          <ProtectedRoute role="parent">
            <SendPhotoScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent"
        element={
          <ProtectedRoute role="parent">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ParentHome />} />
        <Route path="account" element={<AccountSettings />} />
        <Route path="tasks" element={<ParentTasks />} />
        <Route
          path="notes"
          element={
            <FeatureRoute feature="sharedNotes" redirectTo="/parent">
              <SharedNotesScreen />
            </FeatureRoute>
          }
        />
        <Route path="phone-diary" element={<PhoneDiaryScreen />} />
        <Route
          path="remote-help"
          element={
            <FeatureRoute feature="remoteSupport" redirectTo="/parent">
              <ParentRemoteHelpScreen />
            </FeatureRoute>
          }
        />
        <Route path="create-contact" element={<CreateContactScreen />} />
        <Route
          path="documents"
          element={
            <FeatureRoute feature="documents" redirectTo="/parent">
              <DocumentsScreen />
            </FeatureRoute>
          }
        />
        <Route
          path="documents/:categoryId"
          element={
            <FeatureRoute feature="documents" redirectTo="/parent">
              <DocumentFolderScreen />
            </FeatureRoute>
          }
        />
      </Route>
      <Route
        path="/child"
        element={
          <ProtectedRoute role="child">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ChildDashboard />} />
        <Route path="account" element={<AccountSettings />} />
        <Route path="tasks" element={<ChildTasks />} />
        <Route path="tasks/add" element={<ChildTaskCreate />} />
        <Route
          path="notes"
          element={
            <FeatureRoute feature="sharedNotes" redirectTo="/child">
              <SharedNotesScreen />
            </FeatureRoute>
          }
        />
        <Route
          path="documents"
          element={
            <FeatureRoute feature="documents" redirectTo="/child">
              <ChildDocuments />
            </FeatureRoute>
          }
        />
        <Route
          path="documents/:categoryId"
          element={
            <FeatureRoute feature="documents" redirectTo="/child">
              <ChildDocumentFolderScreen />
            </FeatureRoute>
          }
        />
        <Route
          path="remote-support/join"
          element={
            <FeatureRoute feature="remoteSupport" redirectTo="/child">
              <ChildJoinScreenShareScreen />
            </FeatureRoute>
          }
        />
        <Route
          path="remote-support"
          element={
            <FeatureRoute feature="remoteSupport" redirectTo="/child">
              <ChildRemoteSupportScreen />
            </FeatureRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

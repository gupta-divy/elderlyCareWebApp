import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { ParentHome } from './pages/parent/ParentHome';
import { ParentTasks } from './pages/parent/ParentTasks';
import { ParentEmergency } from './pages/parent/ParentEmergency';
import { DocumentsScreen } from './pages/parent/DocumentsScreen';
import { DocumentFolderScreen } from './pages/parent/DocumentFolderScreen';
import { CreateContactScreen } from './pages/parent/CreateContactScreen';
import { FamilyVaultCameraScreen } from './pages/parent/FamilyVaultCameraScreen';
import { FamilyVaultPreviewScreen } from './pages/parent/FamilyVaultPreviewScreen';
import { SendPhotoScreen } from './pages/parent/SendPhotoScreen';
import { ParentRemoteHelpScreen } from './pages/parent/ParentRemoteHelpScreen';
import { ChildDashboard } from './pages/manager/ManagerDashboard';
import { ChildTasks } from './pages/manager/ManagerTasks';
import { ChildDocuments } from './pages/manager/ManagerDocuments';
import { ChildDocumentFolderScreen } from './pages/manager/ManagerDocumentFolderScreen';
import { ChildSettings } from './pages/manager/ManagerSettings';
import { ChildRemoteSupportScreen } from './pages/manager/ChildRemoteSupportScreen';
import { ChildJoinScreenShareScreen } from './pages/manager/ChildJoinScreenShareScreen';

function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactNode;
  role: 'child' | 'parent';
}) {
  const { currentUser, isHydrated } = useApp();
  if (!isHydrated) return null;
  if (!currentUser) return <Navigate to="/" replace />;
  if (currentUser.role !== role) {
    return <Navigate to={role === 'parent' ? '/parent' : '/child'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { currentUser, isHydrated } = useApp();

  return (
    <Routes>
      <Route
        path="/"
        element={
          !isHydrated ? null : currentUser ? (
            <Navigate
              to={currentUser.role === 'parent' ? '/parent' : '/child'}
              replace
            />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/parent/send-photo"
        element={
          <ProtectedRoute role="parent">
            <SendPhotoScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/family-vault/camera"
        element={
          <ProtectedRoute role="parent">
            <FamilyVaultCameraScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/family-vault/:photoId"
        element={
          <ProtectedRoute role="parent">
            <FamilyVaultPreviewScreen />
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
        <Route path="tasks" element={<ParentTasks />} />
        <Route path="emergency" element={<ParentEmergency />} />
        <Route path="remote-help" element={<ParentRemoteHelpScreen />} />
        <Route path="create-contact" element={<CreateContactScreen />} />
        <Route path="documents" element={<DocumentsScreen />} />
        <Route
          path="documents/:categoryId"
          element={<DocumentFolderScreen />}
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
        <Route path="tasks" element={<ChildTasks />} />
        <Route path="documents" element={<ChildDocuments />} />
        <Route
          path="documents/:categoryId"
          element={<ChildDocumentFolderScreen />}
        />
        <Route
          path="family-vault/:photoId"
          element={<FamilyVaultPreviewScreen />}
        />
        <Route path="remote-support/join" element={<ChildJoinScreenShareScreen />} />
        <Route path="remote-support" element={<ChildRemoteSupportScreen />} />
        <Route path="settings" element={<ChildSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

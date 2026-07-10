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
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/" replace />;
  if (currentUser.role !== role) {
    return <Navigate to={role === 'parent' ? '/parent' : '/child'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { currentUser } = useApp();

  return (
    <Routes>
      <Route
        path="/"
        element={
          currentUser ? (
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
        element={
          <ProtectedRoute role="parent">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/parent" element={<ParentHome />} />
        <Route path="/parent/tasks" element={<ParentTasks />} />
        <Route path="/parent/emergency" element={<ParentEmergency />} />
        <Route path="/parent/remote-help" element={<ParentRemoteHelpScreen />} />
        <Route path="/parent/create-contact" element={<CreateContactScreen />} />
        <Route path="/parent/documents" element={<DocumentsScreen />} />
        <Route
          path="/parent/documents/:categoryId"
          element={<DocumentFolderScreen />}
        />
      </Route>
      <Route
        element={
          <ProtectedRoute role="child">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/child" element={<ChildDashboard />} />
        <Route path="/child/tasks" element={<ChildTasks />} />
        <Route path="/child/documents" element={<ChildDocuments />} />
        <Route
          path="/child/documents/:categoryId"
          element={<ChildDocumentFolderScreen />}
        />
        <Route
          path="/child/family-vault/:photoId"
          element={<FamilyVaultPreviewScreen />}
        />
        <Route path="/child/remote-support/join" element={<ChildJoinScreenShareScreen />} />
        <Route path="/child/remote-support" element={<ChildRemoteSupportScreen />} />
        <Route path="/child/settings" element={<ChildSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

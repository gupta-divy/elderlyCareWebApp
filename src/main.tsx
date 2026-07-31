import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { FeatureFlagsProvider } from './features/flags/featureFlags';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FeatureFlagsProvider>
        <AppProvider>
          <AuthProvider>
            <FamilyProvider>
              <App />
            </FamilyProvider>
          </AuthProvider>
        </AppProvider>
      </FeatureFlagsProvider>
    </BrowserRouter>
  </StrictMode>,
);

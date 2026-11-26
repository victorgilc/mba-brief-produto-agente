import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { OrganizerPlaceholderPage } from './pages/OrganizerPlaceholderPage';
import { RegisterPage } from './pages/RegisterPage';
import { StorefrontPage } from './pages/StorefrontPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<StorefrontPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route
              path="/organizador"
              element={
                <ProtectedRoute role="organizer">
                  <OrganizerPlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizador/eventos/:eventId"
              element={
                <ProtectedRoute role="organizer">
                  <OrganizerPlaceholderPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

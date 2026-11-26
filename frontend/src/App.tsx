import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { EventManagePage } from './pages/EventManagePage';
import { LoginPage } from './pages/LoginPage';
import { MyTicketsPage } from './pages/MyTicketsPage';
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage';
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
              path="/meus-ingressos"
              element={
                <ProtectedRoute role="participant">
                  <MyTicketsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizador"
              element={
                <ProtectedRoute role="organizer">
                  <OrganizerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizador/eventos/:eventId"
              element={
                <ProtectedRoute role="organizer">
                  <EventManagePage />
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

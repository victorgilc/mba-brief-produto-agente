import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({
  role,
  children
}: {
  role: 'organizer' | 'participant';
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return (
      <section className="card" role="alert">
        <h1>Acesso negado</h1>
        <p>Você não tem permissão para acessar esta área.</p>
      </section>
    );
  }

  return <>{children}</>;
}

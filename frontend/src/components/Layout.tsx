import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <>
      <header className="site-header">
        <nav className="site-nav" aria-label="Navegação principal">
          <Link to="/" className="brand">
            Catraca
          </Link>
          <div className="nav-links">
            <Link to="/">Vitrine</Link>
            {user?.role === 'participant' && (
              <Link to="/meus-ingressos">Meus ingressos</Link>
            )}
            {user?.role === 'organizer' && (
              <Link to="/organizador">Área do organizador</Link>
            )}
            {!user ? (
              <>
                <Link to="/login">Entrar</Link>
                <Link to="/cadastro">Criar conta</Link>
              </>
            ) : (
              <>
                <span className="nav-user">
                  {user.name} ({user.role === 'organizer' ? 'Organizador' : 'Participante'})
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleLogout}
                >
                  Sair
                </button>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

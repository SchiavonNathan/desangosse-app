import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Home, FileSpreadsheet, BookOpen, Award, FileText,
  Settings, Users, LogOut, Menu, X, LayoutDashboard,
} from 'lucide-react';
import logoImg from '../assets/desangosse.png';
import './Layout.css';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, searchParams]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isActive = (path: string, cat?: string) => {
    if (cat) return location.pathname === path && category === cat;
    if (path === '/dashboard') return location.pathname === path && !category;
    return location.pathname === path;
  };

  const avatarInitial = (user?.fullName || user?.username || '?').charAt(0).toUpperCase();

  return (
    <div className="layout-root">
      {/* Mobile Topbar */}
      <header className="topbar">
        <button className="topbar-menu-btn" onClick={() => setMobileOpen(true)}>
          <Menu size={22} />
        </button>
        <div className="topbar-brand">
          <img src={logoImg} alt="DE SANGOSSE by DSG Logo" className="brand-logo-img" style={{ width: '40px' }} />
          <div className="topbar-brand-text">
            <h2>DE SANGOSSE</h2>
            <span>by DSG</span>
          </div>
        </div>
        <div style={{ width: 38 }} />
      </header>

      {/* Sidebar Overlay (mobile) */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <img src={logoImg} alt="DE SANGOSSE by DSG Logo" className="brand-logo-img" />
          </div>
          <div className="sidebar-brand-text">
            <h2>DE SANGOSSE</h2>
            <span>by DSG</span>
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <span className="nav-section-label">Principal</span>
          <NavItem
            icon={<Home size={18} />}
            label="Início"
            active={isActive('/dashboard')}
            onClick={() => navigate('/dashboard')}
          />

          <div className="nav-divider" />

          <span className="nav-section-label">Conteúdo</span>
          <NavItem
            icon={<FileSpreadsheet size={18} />}
            label="Produtos e Tabelas"
            active={isActive('/dashboard', 'Produtos e tabelas')}
            onClick={() => navigate('/dashboard?category=Produtos e tabelas')}
          />
          <NavItem
            icon={<BookOpen size={18} />}
            label="Culturas"
            active={isActive('/dashboard', 'Culturas')}
            onClick={() => navigate('/dashboard?category=Culturas')}
          />
          <NavItem
            icon={<Award size={18} />}
            label="Resultados"
            active={isActive('/dashboard', 'Resultados')}
            onClick={() => navigate('/dashboard?category=Resultados')}
          />
          <NavItem
            icon={<FileText size={18} />}
            label="Palestras"
            active={isActive('/dashboard', 'Palestras')}
            onClick={() => navigate('/dashboard?category=Palestras')}
          />

          {isAdmin && (
            <>
              <div className="nav-divider" />
              <span className="nav-section-label">Administração</span>
              <NavItem
                icon={<Settings size={18} />}
                label="Upload de PDF"
                active={isActive('/admin')}
                onClick={() => navigate('/admin')}
              />
              <NavItem
                icon={<LayoutDashboard size={18} />}
                label="Gerenciamento"
                active={isActive('/manage')}
                onClick={() => navigate('/manage')}
              />
              <NavItem
                icon={<Users size={18} />}
                label="Usuários"
                active={isActive('/users')}
                onClick={() => navigate('/users')}
              />
            </>
          )}
        </nav>

        {/* Profile */}
        <div className="sidebar-profile">
          <div className="sidebar-profile-inner">
            <div className="sidebar-avatar">{avatarInitial}</div>
            <div className="sidebar-profile-info">
              <span className="sidebar-profile-name">{user?.fullName || user?.username}</span>
              <span className="sidebar-profile-role">{user?.role === 'admin' ? 'Administrador' : 'Usuário'}</span>
            </div>
            <button className="sidebar-logout-btn" onClick={handleLogout} title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content animate-fade-in">
        {children}
      </main>
    </div>
  );
}

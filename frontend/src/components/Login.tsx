import React, { useState } from 'react';
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck, Mail } from 'lucide-react';
import { type User } from '../types';
import { authApi } from '../services/api';
import logoImg from '../assets/logo-Bfsgbzr0.png';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const user = await authApi.login(email.trim(), password);
      onLogin(user as User);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-glass-panel">

        {/* Header */}
        <div className="login-header">
          <div className="login-logo">
            <img src={logoImg} alt="Maradona Menotti" />
          </div>
          <div className="login-badge">
            <ShieldCheck size={12} />
            Acceso Seguro
          </div>
          {/* h2 oculto via CSS — mantiene semántica */}
          <h2>CourseFactory</h2>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(220, 38, 38, 0.12)',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form className="login-form" onSubmit={handleLogin}>

          <div>
            <label htmlFor="cf-email">Usuario / Correo</label>
            <div className="input-group">
              <Mail className="input-icon" size={18} />
              <input
                id="cf-email"
                type="email"
                placeholder="correo@escuela.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="cf-password">Contraseña</label>
            <div className="input-group">
              <Lock className="input-icon" size={18} />
              <input
                id="cf-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingresá tu contraseña"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                style={{ paddingRight: '3rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#4a7575',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  zIndex: 2,
                  transition: 'color 0.2s'
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00e5cc')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a7575')}
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '18px', height: '18px',
                  border: '2px solid rgba(6,20,20,0.3)',
                  borderTopColor: '#061414',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  display: 'inline-block'
                }} />
                Verificando...
              </span>
            ) : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Footer hint */}
        <div className="login-help">
          Acceso restringido a personal autorizado y alumnos matriculados.
        </div>
      </div>
    </div>
  );
};

export default Login;

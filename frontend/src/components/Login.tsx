import React, { useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { type User } from '../types';
import { authApi } from '../services/api';
import logoImg from '../assets/logo_course_factory.jpg';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLoginClick = () => {
    setIsLoading(true);
    setError(null);

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    if (!googleClientId) {
      setError('Error: VITE_GOOGLE_CLIENT_ID no configurada en las variables de entorno.');
      setIsLoading(false);
      return;
    }

    try {
      const google = (window as any).google;
      if (!google || !google.accounts || !google.accounts.oauth2) {
        setError('Error: El SDK de Google no está cargado. Por favor, recargá la página.');
        setIsLoading(false);
        return;
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly',
        callback: async (response: any) => {
          if (response.error) {
            console.error('Error de autenticación Google:', response.error);
            setError(`Error de autenticación: ${response.error_description || response.error}`);
            setIsLoading(false);
            return;
          }

          const accessToken = response.access_token;
          if (!accessToken) {
            setError('Error: No se recibió el token de acceso de Google.');
            setIsLoading(false);
            return;
          }

          try {
            // Enviamos el accessToken al backend para loguear/autoregistrar
            const user = await authApi.googleLogin(undefined, accessToken);
            
            // Guardamos el token de acceso en sessionStorage para que Google Picker lo reuse sin volver a pedir permisos
            sessionStorage.setItem('google_access_token', accessToken);
            
            onLogin(user as User);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al registrarse/iniciar sesión con Google');
            setIsLoading(false);
          }
        }
      });

      client.requestAccessToken();
    } catch (err) {
      console.error(err);
      setError('Error al iniciar el flujo de Google Sign-In.');
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

        <button
          type="button"
          onClick={handleGoogleLoginClick}
          disabled={isLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            fontSize: '0.92rem',
            fontWeight: 600,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
            <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.76 2.13c1.62-1.49 2.53-3.69 2.53-6.26z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.76-2.13c-.76.51-1.74.82-3.2.82-2.46 0-4.54-1.66-5.28-3.9H.95v2.23C2.43 15.89 5.5 18 9 18z"/>
            <path fill="#FBBC05" d="M3.72 10.61c-.19-.58-.3-1.2-.3-1.83 0-.63.11-1.25.3-1.83V4.72H.95C.34 5.95 0 7.39 0 8.9c0 1.51.34 2.95.95 4.18l2.77-2.18z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.8 11.43 0 9 0 5.5 0 2.43 2.11.95 5.12l2.77 2.18C4.46 5.07 6.54 3.58 9 3.58z"/>
          </svg>
          <span style={{ color: '#ffffff' }}>Iniciar sesión con Google</span>
        </button>


        {/* Separadores inferiores eliminados - reubicados arriba del formulario */}

        {/* Footer hint */}
        <div className="login-help">
          Acceso restringido a personal autorizado.
        </div>
      </div>
    </div>
  );
};

export default Login;

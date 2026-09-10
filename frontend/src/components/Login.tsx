import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, ShieldCheck, Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { type User } from '../types';
import { authApi } from '../services/api';
import logoImg from '../assets/logo_blco.png';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // 1. Inicializar Sign In With Google oficial (google.accounts.id)
  useEffect(() => {
    let checkInterval: any;

    const initGsi = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleClientId) return false;

      try {
        google.accounts.id.initialize({
          client_id: googleClientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: async (response: any) => {
            if (response.credential) {
              setIsLoading(true);
              setError(null);
              try {
                const user = await authApi.googleLogin(response.credential);
                onLogin(user as User);
              } catch (err: any) {
                console.error('Error en login con Google (idToken):', err);
                setError(err instanceof Error ? err.message : 'Error al autenticar con Google');
                setIsLoading(false);
              }
            }
          },
        });

        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = '';
          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: 'signin_with',
            width: 320,
            logo_alignment: 'left',
          });
          setGisLoaded(true);
        }

        return true;
      } catch (err) {
        console.error('Error inicializando google.accounts.id:', err);
        return false;
      }
    };

    if (!initGsi()) {
      checkInterval = setInterval(() => {
        if (initGsi()) {
          clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [googleClientId, onLogin]);

  // Fallback Google Sign-In
  const handleManualGoogleLogin = () => {
    setIsLoading(true);
    setError(null);

    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          fallbackOAuth2Token();
        }
      });
      return;
    }

    fallbackOAuth2Token();
  };

  const fallbackOAuth2Token = () => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      setError('El servicio de Google aún se está cargando. Por favor esperá unos segundos e intentá nuevamente.');
      setIsLoading(false);
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'email profile',
        callback: async (response: any) => {
          if (response.error) {
            console.error('Error Google OAuth:', response.error);
            if (response.error === 'popup_closed_by_user') {
              setIsLoading(false);
              return;
            }
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
            const user = await authApi.googleLogin(undefined, accessToken);
            onLogin(user as User);
          } catch (err: any) {
            setError(err instanceof Error ? err.message : 'Error al iniciar sesión con Google');
            setIsLoading(false);
          }
        },
      });

      client.requestAccessToken();
    } catch (err) {
      console.error(err);
      setError('Error al iniciar el flujo de Google Sign-In.');
      setIsLoading(false);
    }
  };

  // Login clásico con correo y contraseña
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const user = await authApi.login(email.trim().toLowerCase(), password);
      onLogin(user as User);
    } catch (err: any) {
      console.error('Error en login con contraseña:', err);
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos');
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

        {/* Botón de Google Sign-In */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: '44px',
          position: 'relative'
        }}>
          {isLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '0.75rem',
              color: '#00e5cc',
              fontSize: '0.9rem',
              fontWeight: 600
            }}>
              <Loader2 size={20} className="animate-spin" />
              <span>Verificando credenciales...</span>
            </div>
          )}

          <div 
            ref={googleBtnRef} 
            style={{ 
              display: isLoading ? 'none' : 'flex', 
              justifyContent: 'center', 
              width: '100%' 
            }}
          />

          {!gisLoaded && !isLoading && (
            <button
              type="button"
              onClick={handleManualGoogleLogin}
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
            >
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.76 2.13c1.62-1.49 2.53-3.69 2.53-6.26z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.76-2.13c-.76.51-1.74.82-3.2.82-2.46 0-4.54-1.66-5.28-3.9H.95v2.23C2.43 15.89 5.5 18 9 18z"/>
                <path fill="#FBBC05" d="M3.72 10.61c-.19-.58-.3-1.2-.3-1.83 0-.63.11-1.25.3-1.83V4.72H.95C.34 5.95 0 7.39 0 8.9c0 1.51.34 2.95.95 4.18l2.77-2.18z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.8 11.43 0 9 0 5.5 0 2.43 2.11.95 5.12l2.77 2.18C4.46 5.07 6.54 3.58 9 3.58z"/>
              </svg>
              <span style={{ color: '#ffffff' }}>Iniciar sesión con Google</span>
            </button>
          )}
        </div>

        {/* Separador */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '0.25rem 0', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            o ingresá con tu cuenta
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
        </div>

        {/* Formulario Correo y Contraseña */}
        <form className="login-form" onSubmit={handlePasswordLogin}>
          <div>
            <label htmlFor="cf-email">Usuario / Correo</label>
            <div className="input-group">
              <Mail className="input-icon" size={18} />
              <input
                id="cf-email"
                type="email"
                placeholder="sistemas@maradonamenotti.com.ar"
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
              <span>Verificando...</span>
            ) : (
              <>
                <span>Ingresar al Sistema</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer hint */}
        <div className="login-help">
          Acceso restringido a personal autorizado.
        </div>
      </div>
    </div>
  );
};

export default Login;

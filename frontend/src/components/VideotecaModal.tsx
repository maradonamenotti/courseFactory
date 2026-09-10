import React, { useState, useEffect } from 'react';
import { Search, Film, Loader2, X, Play, Check } from 'lucide-react';

export interface VideotecaVideo {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  thumbnail_url?: string;
  bunny_video_id?: string;
  bunny_library_id?: string;
  created_at?: string;
}

interface VideotecaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (video: VideotecaVideo) => void;
}

export const VideotecaModal: React.FC<VideotecaModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [videos, setVideos] = useState<VideotecaVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const loadVideos = async () => {
      setLoading(true);
      setError(null);
      try {
        let res = await fetch('/api/videoteca/videos');
        if (!res.ok) {
          res = await fetch('https://videos.maradonamenotti.cloud/api/videos');
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setVideos(data.data);
        } else if (Array.isArray(data)) {
          setVideos(data);
        } else {
          setError('No se pudieron obtener los videos de la videoteca.');
        }
      } catch (err) {
        console.error('Error fetching videoteca:', err);
        setError('Error de conexión con la videoteca (videos.maradonamenotti.cloud)');
      } finally {
        setLoading(false);
      }
    };
    loadVideos();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          color: '#f8fafc'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #51ACC0, #00FFF4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#001716',
              }}
            >
              <Film size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                Videoteca Escuela Maradona Menotti
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Selecciona un video para vincular directamente a esta clase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#0f172a' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              padding: '0.6rem 1rem',
            }}
          >
            <Search size={16} style={{ color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar video por título o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                width: '100%',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>

        {/* Video List */}
        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', background: '#0f172a' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#51ACC0', gap: '10px' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Cargando videos de la plataforma...</span>
            </div>
          )}

          {error && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px' }}>
              {error}
            </div>
          )}

          {!loading && !error && filteredVideos.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              No se encontraron videos que coincidan con la búsqueda.
            </div>
          )}

          {!loading && !error && filteredVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => {
                onSelect(video);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '0.8rem 1rem',
                borderRadius: '12px',
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#334155';
                e.currentTarget.style.borderColor = '#51ACC0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1e293b';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: '80px',
                  height: '48px',
                  borderRadius: '8px',
                  background: '#000',
                  overflow: 'hidden',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#51ACC0' }}>
                    <Play size={20} />
                  </div>
                )}
                {video.duration ? (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.8)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      padding: '1px 4px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {formatDuration(video.duration)}
                  </span>
                ) : null}
              </div>

              {/* Title & info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {video.title}
                </h4>
                {video.description && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {video.description}
                  </p>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #51ACC0, #00FFF4)',
                  color: '#001716',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0,
                }}
              >
                <Check size={14} /> Seleccionar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

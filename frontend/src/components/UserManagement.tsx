import React, { useState } from 'react';
import { User as UserIcon, Shield, Search, UserPlus, Edit2, Trash2, X, Check, KeyRound, AlertTriangle, CheckCircle } from 'lucide-react';
import { type User, DEFAULT_PASSWORD } from '../types';
import { useDialog } from './CustomDialog';

interface UserManagementProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const panelsInfo = [
  { id: 1, name: 'Panel 1: Contenido', desc: 'Edición y carga de guiones/unidades' },
  { id: 2, name: 'Panel 2: Multimedia', desc: 'Producción y carga de recursos interactivos' },
  { id: 3, name: 'Panel 3: Verificación', desc: 'Aprobación de calidad final' },
  { id: 4, name: 'Panel 4: Maquetado', desc: 'Configuración estética y plantillas' },
  { id: 5, name: 'Panel 5: Sistemas', desc: 'Estado global de la carga e integración LMS' },
  { id: 6, name: 'Panel 6: Analítica', desc: 'Métricas de avance y gráficos de producción' },
];

const UserManagement: React.FC<UserManagementProps> = ({ users, setUsers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [formAllowedPanels, setFormAllowedPanels] = useState<number[]>([]);
  const { showAlert, showConfirm, DialogRenderer } = useDialog();

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormIsAdmin(false);
    setFormAllowedPanels([1]); // default to Panel 1
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormIsAdmin(user.isAdmin);
    setFormAllowedPanels(user.allowedPanels || []);
    setIsModalOpen(true);
  };

  const handleTogglePanel = (panelId: number) => {
    if (formAllowedPanels.includes(panelId)) {
      setFormAllowedPanels(formAllowedPanels.filter(id => id !== panelId));
    } else {
      setFormAllowedPanels([...formAllowedPanels, panelId]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    const determinedRole = formIsAdmin ? 'admin' :
      formAllowedPanels.includes(1) ? 'autor' :
      formAllowedPanels.includes(2) ? 'multimedia' :
      formAllowedPanels.includes(3) ? 'verificador' :
      formAllowedPanels.includes(4) ? 'diseno' :
      formAllowedPanels.includes(5) ? 'sistemas' :
      formAllowedPanels.includes(6) ? 'analitica' : 'autor';

    if (editingUser) {
      // Edit user
      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        role: determinedRole,
        isAdmin: formIsAdmin,
        allowedPanels: formIsAdmin ? [1, 2, 3, 4, 5, 6] : formAllowedPanels
      } : u));
    } else {
      // Add user with default password
      const newUser: User = {
        id: Date.now().toString(),
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        role: determinedRole,
        isAdmin: formIsAdmin,
        allowedPanels: formIsAdmin ? [1, 2, 3, 4, 5, 6] : formAllowedPanels,
        password: DEFAULT_PASSWORD,
        mustChangePassword: true
      };
      setUsers(prev => [...prev, newUser]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (userId: string, userName: string) => {
    if (users.length <= 1) {
      showAlert('Acción no permitida', 'Debe haber al menos un usuario registrado en el sistema.', 'warning');
      return;
    }
    showConfirm(
      '🗑️ Eliminar Usuario',
      `¿Estás seguro de que deseas eliminar al usuario "${userName}"?`,
      () => setUsers(prev => prev.filter(u => u.id !== userId)),
      'danger',
      'Eliminar',
      'Cancelar'
    );
  };

  const handleResetPassword = (userId: string, userName: string) => {
    showConfirm(
      '🔑 Reiniciar Contraseña',
      `¿Reiniciar la contraseña de "${userName}" a la clave por defecto (${DEFAULT_PASSWORD})? El usuario deberá cambiarla en su próximo ingreso.`,
      () => setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: DEFAULT_PASSWORD, mustChangePassword: true } : u)),
      'warning',
      'Reiniciar',
      'Cancelar'
    );
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterRole === 'admin') return u.isAdmin;
    if (filterRole === 'panel1') return u.isAdmin || u.allowedPanels.includes(1);
    if (filterRole === 'panel2') return u.isAdmin || u.allowedPanels.includes(2);
    if (filterRole === 'panel3') return u.isAdmin || u.allowedPanels.includes(3);
    if (filterRole === 'panel4') return u.isAdmin || u.allowedPanels.includes(4);
    if (filterRole === 'panel5') return u.isAdmin || u.allowedPanels.includes(5);
    if (filterRole === 'panel6') return u.isAdmin || u.allowedPanels.includes(6);
    
    return true;
  });

  return (
    <div className="users-container animate-fade-in" style={{ padding: '2.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="dashboard-title" style={{ marginBottom: '0.5rem' }}>Gestión de Usuarios</h1>
          <p className="text-muted">Administra el acceso y permisos a los diferentes paneles en CourseFactory.</p>
        </div>
        
        <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserPlus size={18} />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="search-container" style={{ width: '350px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <Search size={18} className="search-icon text-muted" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o correo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            style={{ background: 'transparent', color: 'var(--text-main)' }}
          />
        </div>
        
        <select 
          className="table-select" 
          style={{ width: '250px', background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '8px' }}
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="">Filtrar por acceso</option>
          <option value="admin">Administradores</option>
          <option value="panel1">Panel 1: Contenido</option>
          <option value="panel2">Panel 2: Multimedia</option>
          <option value="panel3">Panel 3: Verificación</option>
          <option value="panel4">Panel 4: Maquetado</option>
          <option value="panel5">Panel 5: Sistemas</option>
          <option value="panel6">Panel 6: Analítica</option>
        </select>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="content-table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>USUARIO</th>
              <th>TIPO</th>
              <th>PANELES PERMITIDOS</th>
              <th style={{ width: '80px', textAlign: 'center' }}>CLAVE</th>
              <th style={{ width: '150px', textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', 
                      background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '1.2rem'
                    }}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.8rem', borderRadius: '999px',
                    background: u.isAdmin ? 'rgba(79, 70, 229, 0.1)' : 'rgba(0,0,0,0.05)',
                    color: u.isAdmin ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '0.8rem', fontWeight: 600
                  }}>
                    {u.isAdmin ? <Shield size={14} /> : <UserIcon size={14} />}
                    {u.isAdmin ? 'Administrador' : 'Usuario'}
                  </span>
                </td>
                <td>
                  {u.isAdmin ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                      Todos los paneles (Acceso Total)
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {u.allowedPanels && u.allowedPanels.length > 0 ? (
                        u.allowedPanels.map(p => {
                          const name = panelsInfo.find(info => info.id === p)?.name.split(':')[1]?.trim() || `Panel ${p}`;
                          return (
                            <span 
                              key={p} 
                              style={{ 
                                padding: '2px 8px', 
                                background: 'var(--bg-primary)', 
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)', 
                                borderRadius: '4px', 
                                fontSize: '0.75rem' 
                              }}
                            >
                              P{p}: {name}
                            </span>
                          );
                        })
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#dc2626', fontStyle: 'italic' }}>
                          Sin accesos asignados
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {u.mustChangePassword ? (
                      <span title="Debe cambiar clave en próximo ingreso" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                        background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.2)'
                      }}>
                        <AlertTriangle size={12} />
                        Pendiente
                      </span>
                    ) : (
                      <span title="Contraseña personalizada" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                        background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                        border: '1px solid rgba(34, 197, 94, 0.2)'
                      }}>
                        <CheckCircle size={12} />
                        OK
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                    <button className="icon-btn" onClick={() => handleOpenEditModal(u)} title="Editar usuario">
                      <Edit2 size={16} />
                    </button>
                    <button className="icon-btn" onClick={() => handleResetPassword(u.id, u.name)} title="Reiniciar contraseña" style={{ color: '#f59e0b' }}>
                      <KeyRound size={16} />
                    </button>
                    <button className="icon-btn" onClick={() => handleDelete(u.id, u.name)} title="Eliminar usuario" style={{ color: '#ff4444' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No se encontraron usuarios.
          </div>
        )}
      </div>

      {/* User Edit / Add Modal */}
      {isModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="modal-content glass-panel" style={{
            background: 'var(--bg-secondary)', width: '100%', maxWidth: '550px',
            borderRadius: '16px', padding: '0', overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border)'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem', background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {editingUser ? <Edit2 size={22} color="white" /> : <UserPlus size={22} color="white" />}
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white' }}>
                  {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Name */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="input-field"
                    style={{ background: 'var(--bg-primary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="Ej: juan@escuela.com"
                    className="input-field"
                    style={{ background: 'var(--bg-primary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                  />
                </div>

                {/* Is Admin Checkbox */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  padding: '1rem',
                  background: 'var(--bg-primary)',
                  borderRadius: '10px',
                  border: '1px solid var(--border)'
                }}>
                  <input
                    type="checkbox"
                    id="isAdminCheck"
                    checked={formIsAdmin}
                    onChange={(e) => setFormIsAdmin(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="isAdminCheck" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Administrador</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tiene acceso total a todos los paneles y gestión de usuarios</span>
                  </label>
                </div>

                {/* Panel Permissions Checklist */}
                {!formIsAdmin && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      Paneles Permitidos
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {panelsInfo.map(panel => {
                        const isChecked = formAllowedPanels.includes(panel.id);
                        return (
                          <div 
                            key={panel.id}
                            onClick={() => handleTogglePanel(panel.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem 1rem',
                              borderRadius: '8px',
                              background: isChecked ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-primary)',
                              border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border)',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                {panel.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {panel.desc}
                              </div>
                            </div>
                            <div style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              border: '2px solid',
                              borderColor: isChecked ? 'var(--primary)' : 'var(--text-muted)',
                              background: isChecked ? 'var(--primary)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}>
                              {isChecked && <Check size={14} color="white" strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{ 
                padding: '1.25rem 1.5rem', 
                background: 'var(--bg-primary)', 
                borderTop: '1px solid var(--border)', 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '0.75rem' 
              }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {DialogRenderer}
    </div>
  );
};

export default UserManagement;

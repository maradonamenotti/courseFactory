import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

const userRepo = () => AppDataSource.getRepository(User);

const signToken = (user: User) =>
  jwt.sign(
    {
      userId: user.id,
      role: user.role,
      isAdmin: user.isAdmin,
      canEdit: user.canEdit,
      canDelete: user.canDelete,
      allowedPanels: user.allowedPanels,
      mustChangePassword: user.mustChangePassword,
    },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'] }
  );

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email y contraseña son requeridos' });
    return;
  }

  const user = await userRepo().findOne({ where: { email: email.toLowerCase().trim() } });

  if (!user) {
    res.status(401).json({ message: 'Credenciales inválidas' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Credenciales inválidas' });
    return;
  }

  const token = signToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isAdmin: user.isAdmin,
      canEdit: user.canEdit,
      canDelete: user.canDelete,
      allowedPanels: user.allowedPanels,
      mustChangePassword: user.mustChangePassword,
    },
  });
};

// POST /api/auth/google-login
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  const { idToken, accessToken } = req.body;

  if (!idToken && !accessToken) {
    res.status(400).json({ message: 'El token de Google (idToken o accessToken) es requerido' });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ message: 'Autenticación con Google no configurada en el servidor' });
    return;
  }

  const client = new OAuth2Client(clientId);

  try {
    let email = '';
    let name = '';

    if (idToken) {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        res.status(401).json({ message: 'Token de Google inválido' });
        return;
      }
      email = payload.email.toLowerCase().trim();
      name = payload.name || email.split('@')[0];
    } else if (accessToken) {
      // Validamos el accessToken consultando el endpoint de Google UserInfo
      const tokenInfo = await client.getTokenInfo(accessToken);
      if (!tokenInfo || !tokenInfo.email) {
        res.status(401).json({ message: 'Access Token de Google inválido' });
        return;
      }
      email = tokenInfo.email.toLowerCase().trim();
      
      // Intentamos obtener el nombre del usuario desde Google UserInfo API
      try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
        if (response.ok) {
          const userInfo = await response.json() as any;
          name = userInfo.name || userInfo.given_name || email.split('@')[0];
        }
      } catch (err) {
        console.error('Error al obtener userinfo de Google:', err);
      }
      if (!name) {
        name = email.split('@')[0];
      }
    }

    // Verificamos si el usuario ya existe en nuestra base de datos, de lo contrario lo autoregistramos
    let user = await userRepo().findOne({ where: { email } });
    const isSuperAdmin = email === 'mcastro@maradonamenotti.com.ar' || email === 'sistemas@maradonamenotti.ar';

    if (!user) {
      const dummyPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const passwordHash = await bcrypt.hash(dummyPassword, 12);
      
      user = userRepo().create({
        email,
        name,
        role: isSuperAdmin ? 'admin' : 'autor',
        isAdmin: isSuperAdmin,
        canEdit: isSuperAdmin,
        canDelete: isSuperAdmin,
        allowedPanels: isSuperAdmin ? [1, 2, 3, 4, 5, 6, 7] : [],
        passwordHash,
        mustChangePassword: false, // Ingresó por Google, no necesita cambiar contraseña por ahora
      });
      await userRepo().save(user);
    } else if (isSuperAdmin && (!user.isAdmin || user.role !== 'admin' || user.allowedPanels.length < 7)) {
      // Si el usuario ya existe pero es Manuela o Federico, nos aseguramos de que tengan rol de administrador y todos los accesos
      user.role = 'admin';
      user.isAdmin = true;
      user.canEdit = true;
      user.canDelete = true;
      user.allowedPanels = [1, 2, 3, 4, 5, 6, 7];
      await userRepo().save(user);
    }

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
        canEdit: user.canEdit,
        canDelete: user.canDelete,
        allowedPanels: user.allowedPanels,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Error verificando Google Token:', error);
    res.status(401).json({ message: 'El token de Google expiró o es inválido' });
  }
};

// GET /api/auth/me
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await userRepo().findOne({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado' });
    return;
  }
  const { passwordHash, ...userData } = user;
  void passwordHash;
  res.json(userData);
};

// PATCH /api/auth/change-password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    return;
  }

  const user = await userRepo().findOne({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado' });
    return;
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  await userRepo().save(user);

  // Retornar nuevo token sin mustChangePassword
  const token = signToken(user);
  res.json({ token, message: 'Contraseña actualizada correctamente' });
};

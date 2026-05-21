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
      allowedPanels: user.allowedPanels,
      mustChangePassword: user.mustChangePassword,
    },
  });
};

// POST /api/auth/google-login
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400).json({ message: 'El token de Google es requerido' });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ message: 'Autenticación con Google no configurada en el servidor' });
    return;
  }

  const client = new OAuth2Client(clientId);

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ message: 'Token de Google inválido' });
      return;
    }

    const email = payload.email.toLowerCase().trim();

    // Verificamos si el usuario ya existe en nuestra base de datos
    const user = await userRepo().findOne({ where: { email } });

    if (!user) {
      res.status(403).json({ 
        message: 'Acceso denegado: tu cuenta no está registrada en la plataforma. Por favor, contactá al administrador.' 
      });
      return;
    }

    // El usuario existe. Como se autenticó con Google, si tenía mustChangePassword, 
    // podemos decidir si se lo forzamos igual (por si intenta login clásico), 
    // pero para el login con Google simplemente lo dejamos entrar.
    // Opcionalmente, podrías poner mustChangePassword a false, pero es mejor dejarlo
    // por si alguna vez usa contraseña normal.

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
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

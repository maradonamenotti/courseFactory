import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  role: string;
  isAdmin: boolean;
  allowedPanels: number[];
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token no proporcionado' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

// Solo permite continuar si el usuario NO tiene mustChangePassword pendiente
export const requireFullAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.mustChangePassword) {
    res.status(403).json({
      message: 'Debés cambiar tu contraseña antes de continuar',
      code: 'MUST_CHANGE_PASSWORD',
    });
    return;
  }
  next();
};

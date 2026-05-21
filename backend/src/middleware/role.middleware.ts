import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ message: 'Acceso denegado: se requieren permisos de administrador' });
    return;
  }
  next();
};

export const requirePanel = (panelNumber: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.isAdmin) {
      next();
      return;
    }
    if (!req.user?.allowedPanels.includes(panelNumber)) {
      res.status(403).json({ message: `Acceso denegado: no tenés acceso al panel ${panelNumber}` });
      return;
    }
    next();
  };
};

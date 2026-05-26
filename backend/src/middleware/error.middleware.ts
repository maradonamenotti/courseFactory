import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// Middleware de manejo de errores global (4 parámetros = Express lo reconoce como error handler)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[ERROR] ${err.message}`, isDev ? err.stack : '');

  res.status(statusCode).json({
    message: err.message || 'Error interno del servidor',
    ...(isDev && { stack: err.stack }),
  });
};

// Helper para crear errores operacionales con código HTTP
export const createError = (message: string, statusCode: number): AppError => {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
};

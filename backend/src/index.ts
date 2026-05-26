import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from './config/database';
import { errorHandler } from './middleware/error.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import foldersRoutes from './routes/folders.routes';
import coursesRoutes from './routes/courses.routes';
import rowsRoutes from './routes/rows.routes';
import templatesRoutes from './routes/templates.routes';
import tasksRoutes from './routes/tasks.routes';
import libraryRoutes from './routes/library.routes';
import filesRoutes from './routes/files.routes';
import systemsRoutes from './routes/systems.routes';
import exportRoutes from './routes/export.routes';
import vimeoRoutes from './routes/vimeo.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globales ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/courses', rowsRoutes);        // /api/courses/:courseId/rows
app.use('/api/courses', exportRoutes);      // /api/courses/:courseId/export
app.use('/api/templates', templatesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/systems', systemsRoutes);
app.use('/api/vimeo', vimeoRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// ─── Error handler global ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Inicializar DB y levantar servidor ──────────────────────────────────────
AppDataSource.initialize()
  .then(() => {
    console.log('✅ Conexión a PostgreSQL establecida');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📡 API disponible en http://localhost:${PORT}/api`);
    });
  })
  .catch((error) => {
    console.error('❌ Error al conectar con PostgreSQL:', error);
    process.exit(1);
  });

export default app;

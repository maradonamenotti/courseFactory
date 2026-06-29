import { Request, Response } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AppDataSource } from '../config/database';
import { CourseRow } from '../entities/CourseRow';
import { Course } from '../entities/Course';

const BACKUP_BASE_DIR = '/app/backups';
const COURSES_BACKUP_DIR = path.join(BACKUP_BASE_DIR, 'courses');

// Asegurar que los directorios de backups existen
if (!fs.existsSync(COURSES_BACKUP_DIR)) {
  fs.mkdirSync(COURSES_BACKUP_DIR, { recursive: true });
}

/**
 * Endpoint para descargar una copia de seguridad en vivo (.sql) de la base de datos de CourseFactory.
 * GET /api/backup/download
 */
export const downloadBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USERNAME || 'postgres';
    const dbName = process.env.DB_NAME || 'coursefactory-bdd';
    const dbPass = process.env.DB_PASSWORD || 'Riverplate912';

    // Generar nombre de archivo
    const dateStr = new Date().toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');
    const filename = `coursefactory_backup_${dateStr}.sql`;

    // Configurar cabeceras de respuesta HTTP para descarga
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Iniciar pg_dump
    const pgDump = spawn('pg_dump', [
      '-h', dbHost,
      '-p', dbPort,
      '-U', dbUser,
      '-d', dbName,
      '--clean', // Incluye cláusulas DROP TABLE
      '--if-exists'
    ], {
      env: {
        ...process.env,
        PGPASSWORD: dbPass
      }
    });

    // Pipe del stream de salida estándar de pg_dump a la respuesta HTTP
    pgDump.stdout.pipe(res);

    // Capturar errores del canal stderr
    let stderrData = '';
    pgDump.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pgDump.on('close', (code) => {
      if (code !== 0) {
        console.error(`pg_dump finalizó con código de salida ${code}: ${stderrData}`);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error al generar la copia de seguridad', error: stderrData });
        }
      }
    });

    pgDump.on('error', (err) => {
      console.error('Error al iniciar pg_dump:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error al iniciar la herramienta de base de datos', error: err.message });
      }
    });

  } catch (err: any) {
    console.error('Excepción en downloadBackup:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error inesperado al descargar copia de seguridad', error: err.message });
    }
  }
};

/**
 * Función auxiliar para limpiar backups antiguos de un curso (más de N días)
 */
const cleanOldCourseBackups = (courseId: string, daysLimit: number) => {
  try {
    const courseDir = path.join(COURSES_BACKUP_DIR, courseId);
    if (!fs.existsSync(courseDir)) return;

    const files = fs.readdirSync(courseDir);
    const now = Date.now();
    const msLimit = daysLimit * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(courseDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;
        if (age > msLimit) {
          fs.unlinkSync(filePath);
          console.log(`[Backup Limpieza] Eliminado backup antiguo para curso ${courseId}: ${file}`);
        }
      }
    });
  } catch (err) {
    console.error(`Error al limpiar backups antiguos del curso ${courseId}:`, err);
  }
};

/**
 * 1. Crea un punto de restauración individual para un curso específico
 * POST /api/backup/courses/:courseId/snapshot
 */
export const createCourseSnapshot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const courseRepo = AppDataSource.getRepository(Course);
    const rowRepo = AppDataSource.getRepository(CourseRow);

    const course = await courseRepo.findOne({ where: { id: courseId } });
    if (!course) {
      res.status(404).json({ message: 'Curso no encontrado' });
      return;
    }

    const rows = await rowRepo.find({
      where: { courseId },
      order: { sortOrder: 'ASC' }
    });

    const snapshot = {
      courseId,
      courseName: course.name,
      backupDate: new Date().toISOString(),
      rows: rows.map(r => ({ ...r }))
    };

    const courseDir = path.join(COURSES_BACKUP_DIR, courseId);
    if (!fs.existsSync(courseDir)) {
      fs.mkdirSync(courseDir, { recursive: true });
    }

    const dateStr = new Date().toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');
    
    const isAuto = req.query.auto === 'true';
    const prefix = isAuto ? 'auto' : 'manual';
    const filename = `${prefix}_backup_${dateStr}.json`;
    const filePath = path.join(courseDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

    // Mantener solo los últimos 7 días de backups
    cleanOldCourseBackups(courseId, 7);

    res.json({ message: 'Punto de restauración creado con éxito', filename });
  } catch (err: any) {
    console.error('Error al crear snapshot del curso:', err);
    res.status(500).json({ message: 'Error al crear la copia de seguridad del curso', error: err.message });
  }
};

/**
 * 2. Devuelve el listado de copias de seguridad de un curso
 * GET /api/backup/courses/:courseId/list
 */
export const listCourseBackups = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const courseDir = path.join(COURSES_BACKUP_DIR, courseId);

    if (!fs.existsSync(courseDir)) {
      res.json([]);
      return;
    }

    const files = fs.readdirSync(courseDir);
    const backupsList = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(courseDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          date: stats.mtime,
          sizeBytes: stats.size,
          isAuto: file.startsWith('auto')
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Más recientes primero

    res.json(backupsList);
  } catch (err: any) {
    console.error('Error al listar backups del curso:', err);
    res.status(500).json({ message: 'Error al listar copias de seguridad', error: err.message });
  }
};

/**
 * 3. Restaura un curso al estado de un punto de restauración específico
 * POST /api/backup/courses/:courseId/restore
 */
export const restoreCourseBackup = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ message: 'Acceso denegado: se requieren permisos de administrador' });
    return;
  }

  const { courseId } = req.params;
  const { filename } = req.body;

  if (!filename) {
    res.status(400).json({ message: 'Nombre de archivo requerido' });
    return;
  }

  try {
    const filePath = path.join(COURSES_BACKUP_DIR, courseId, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'Archivo de copia de seguridad no encontrado' });
      return;
    }

    const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (backupData.courseId !== courseId) {
      res.status(400).json({ message: 'El archivo de backup no corresponde a este curso' });
      return;
    }

    // Iniciar transacción de base de datos
    await AppDataSource.transaction(async (transactionalEntityManager) => {
      // 1. Eliminar las filas actuales del curso
      await transactionalEntityManager.delete(CourseRow, { courseId });

      // 2. Re-insertar las filas desde el backup
      const rowsToInsert = backupData.rows.map((rData: any) => {
        return transactionalEntityManager.create(CourseRow, rData);
      });

      if (rowsToInsert.length > 0) {
        await transactionalEntityManager.save(CourseRow, rowsToInsert);
      }
    });

    res.json({ message: 'Curso restaurado con éxito al punto seleccionado' });
  } catch (err: any) {
    console.error('Error al restaurar backup del curso:', err);
    res.status(500).json({ message: 'Error al restaurar la copia de seguridad del curso', error: err.message });
  }
};

/**
 * 4. Descarga el archivo de backup JSON del curso individual
 * GET /api/backup/courses/:courseId/download/:filename
 */
export const downloadCourseBackup = async (req: Request, res: Response): Promise<void> => {
  const { courseId, filename } = req.params;
  const filePath = path.join(COURSES_BACKUP_DIR, courseId, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: 'Archivo no encontrado' });
    return;
  }

  res.download(filePath, filename);
};

/**
 * 5. Genera snapshots automáticos para todos los cursos activos del sistema
 * POST /api/backup/courses/run-daily
 */
export const runDailyCourseSnapshots = async (req: Request, res: Response): Promise<void> => {
  // Opcional: Proteger con una API key o validar origen local
  try {
    const courseRepo = AppDataSource.getRepository(Course);
    const rowRepo = AppDataSource.getRepository(CourseRow);
    const courses = await courseRepo.find();

    const timestamp = new Date().toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');

    const results = [];

    for (const course of courses) {
      const rows = await rowRepo.find({ where: { courseId: course.id } });
      
      // Solo hacer backup si el curso tiene contenido
      if (rows.length > 0) {
        const snapshot = {
          courseId: course.id,
          courseName: course.name,
          backupDate: new Date().toISOString(),
          rows: rows.map(r => ({ ...r }))
        };

        const courseDir = path.join(COURSES_BACKUP_DIR, course.id);
        if (!fs.existsSync(courseDir)) {
          fs.mkdirSync(courseDir, { recursive: true });
        }

        const filename = `auto_backup_${timestamp}.json`;
        const filePath = path.join(courseDir, filename);

        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

        // Limpiar backups antiguos mayores a 7 días
        cleanOldCourseBackups(course.id, 7);

        results.push({ courseId: course.id, courseName: course.name, status: 'success', filename });
      }
    }

    res.json({ message: 'Copias de seguridad diarias generadas para todos los cursos', results });
  } catch (err: any) {
    console.error('Error al ejecutar backup diario de cursos:', err);
    res.status(500).json({ message: 'Error al ejecutar backup diario de cursos', error: err.message });
  }
};

import { Request, Response } from 'express';
import { spawn } from 'child_process';

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

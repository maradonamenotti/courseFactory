import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { RowHistory } from '../entities/RowHistory';
import { CourseRow } from '../entities/CourseRow';

const historyRepo = () => AppDataSource.getRepository(RowHistory);
const rowRepo = () => AppDataSource.getRepository(CourseRow);

// GET /api/courses/:courseId/rows/:rowId/history
export const getRowHistory = async (req: Request, res: Response): Promise<void> => {
  const { rowId } = req.params;

  const history = await historyRepo().find({
    where: { rowId },
    order: { createdAt: 'DESC' },
  });

  res.json(history);
};

// GET /api/courses/:courseId/history
export const getCourseHistory = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;

  const history = await historyRepo().find({
    where: { courseId },
    order: { createdAt: 'DESC' },
    take: 200, // máximo 200 entradas para el panel del curso
  });

  res.json(history);
};

// POST /api/courses/:courseId/rows/:rowId/history/:historyId/restore
export const restoreRowHistory = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para restaurar cambios' });
    return;
  }

  const { rowId, courseId, historyId } = req.params;

  const historyEntry = await historyRepo().findOne({ where: { id: historyId, rowId } });
  if (!historyEntry) {
    res.status(404).json({ message: 'Entrada de historial no encontrada' });
    return;
  }

  const row = await rowRepo().findOne({ where: { id: rowId, courseId } });
  if (!row) {
    res.status(404).json({ message: 'Fila no encontrada' });
    return;
  }

  // Campos seguros para restaurar (excluimos id, courseId, sortOrder)
  const SAFE_RESTORE_FIELDS = [
    'materia', 'modulo', 'descripcion', 'formato', 'links',
    'fileName', 'fileType', 'fileUrl', 'htmlContent', 'estado',
    'videoDrive', 'videoVimeo', 'videoSubtitulos',
    'geniallyUrl', 'geniallyLinkStatus', 'geniallyTextoStatus', 'geniallyDisenoStatus', 'estadoMultimedia',
    'aprobacionContenido', 'aprobacionMultimedia', 'comentariosRevisor',
    'estadoFinal', 'aprobacionDiseno', 'aprobacionTraduccion',
  ];

  const snapshotRecord = historyEntry.snapshot as Record<string, unknown>;
  const rowRecord = row as unknown as Record<string, unknown>;
  for (const field of SAFE_RESTORE_FIELDS) {
    if (field in snapshotRecord) {
      rowRecord[field] = snapshotRecord[field];
    }
  }

  const saved = await rowRepo().save(row);
  res.json(saved);
};

import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CourseRow } from '../entities/CourseRow';
import { Course } from '../entities/Course';
import { RowHistory } from '../entities/RowHistory';
import { User } from '../entities/User';
import { Task } from '../entities/Task';

// Campos que pertenecen a cada panel (para determinar el panel del cambio)
const PANEL_FIELDS: Record<number, string[]> = {
  1: ['materia', 'modulo', 'moduloNumero', 'descripcion', 'formato', 'links', 'fileName', 'fileType', 'fileUrl', 'htmlContent', 'estado'],
  2: ['videoDrive', 'videoVimeo', 'videoSubtitulos', 'geniallyUrl', 'geniallyLinkStatus', 'geniallyTextoStatus', 'geniallyDisenoStatus', 'estadoMultimedia'],
  3: ['aprobacionContenido', 'aprobacionMultimedia', 'comentariosRevisor', 'estadoFinal', 'aprobacionDiseno', 'aprobacionTraduccion'],
};

function detectPanel(changedFields: string[]): number {
  for (const panel of [1, 2, 3]) {
    if (changedFields.some((f) => PANEL_FIELDS[panel].includes(f))) return panel;
  }
  return 1;
}

// Genera una descripción legible de los cambios
function buildDescription(changedFields: string[], before: Record<string, unknown>, after: Record<string, unknown>): string {
  return changedFields
    .map((field) => {
      const prev = String(before[field] ?? '');
      const next = String(after[field] ?? '');
      return `${field}: "${prev}" → "${next}"`;
    })
    .join(' | ');
}

const rowRepo = () => AppDataSource.getRepository(CourseRow);
const courseRepo = () => AppDataSource.getRepository(Course);

// GET /api/courses/:courseId/rows
export const getRows = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;

  const rows = await rowRepo().find({
    where: { courseId },
    order: { sortOrder: 'ASC' },
  });

  res.json(rows);
};

// POST /api/courses/:courseId/rows
export const createRow = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para realizar modificaciones' });
    return;
  }

  const { courseId } = req.params;

  const course = await courseRepo().findOne({ where: { id: courseId } });
  if (!course) {
    res.status(404).json({ message: 'Curso no encontrado' });
    return;
  }

  // Calcular sortOrder máximo actual
  const count = await rowRepo().count({ where: { courseId } });

  const row = rowRepo().create({
    ...req.body,
    courseId,
    sortOrder: count,
  });

  const saved = await rowRepo().save(row);
  res.status(201).json(saved);
};

// PUT /api/courses/:courseId/rows/:rowId
export const updateRow = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para realizar modificaciones' });
    return;
  }

  const { courseId, rowId } = req.params;

  const row = await rowRepo().findOne({ where: { id: rowId, courseId } });
  if (!row) {
    res.status(404).json({ message: 'Fila no encontrada' });
    return;
  }

  // Lógica de sincronización bidireccional (igual que en el frontend)
  const updates = { ...req.body };

  if (updates.links !== undefined) {
    if (row.formato === 'VIDEO') updates.videoDrive = updates.links;
    else if (row.formato === 'GENIALLY') updates.geniallyUrl = updates.links;
  }
  if (updates.videoDrive !== undefined && row.formato === 'VIDEO') {
    updates.links = updates.videoDrive;
  }
  if (updates.geniallyUrl !== undefined && row.formato === 'GENIALLY') {
    updates.links = updates.geniallyUrl;
  }

  // ── Historial: snapshot ANTES del cambio ─────────────────────────────────
  const snapshot: Record<string, unknown> = { ...(row as unknown as Record<string, unknown>) };

  const changedFields = Object.keys(updates).filter((key) => {
    const rowRecord = row as unknown as Record<string, unknown>;
    return key in rowRecord && String(rowRecord[key]) !== String(updates[key]);
  });

  if (changedFields.length > 0) {
    const updatesRecord = updates as Record<string, unknown>;
    const historyRepo = AppDataSource.getRepository(RowHistory);
    const userRepo = AppDataSource.getRepository(User);
    const dbUser = await userRepo.findOne({ where: { id: req.user!.userId } });
    const userName = dbUser?.name || req.user!.role || 'Usuario desconocido';

    const historyEntry = historyRepo.create({
      rowId,
      courseId,
      userId: req.user!.userId,
      userName,
      changedFields,
      description: buildDescription(changedFields, snapshot, updatesRecord),
      panel: detectPanel(changedFields),
      snapshot,
    });
    await historyRepo.save(historyEntry);
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Create auto-task alert on Google Drive resync
  const wasGoogleDoc = !!row.googleFileId;
  if (wasGoogleDoc && updates.googleLastSyncedAt !== undefined) {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const dbUser = await userRepo.findOne({ where: { id: req.user!.userId } });
      const userName = dbUser?.name || req.user!.role || 'Usuario';

      const courseRepo = AppDataSource.getRepository(Course);
      const course = await courseRepo.findOne({ where: { id: courseId } });

      const taskRepo = AppDataSource.getRepository(Task);
      const newTask = taskRepo.create({
        title: `⚠️ Archivo de Drive actualizado: Clase ${row.sortOrder + 1}`,
        description: `El archivo de Google Drive "${updates.fileName || row.fileName || 'documento'}" fue actualizado e importado de nuevo.\n\nUbicación:\n- Curso: ${course?.name || 'Desconocido'}\n- Materia: ${row.materia}\n- Clase: ${row.modulo || 'Sin clase'}\n- Posición: ${row.sortOrder + 1}`,
        courseId,
        courseName: course?.name || null,
        rowId,
        rowNro: String(row.sortOrder + 1),
        rowModulo: row.modulo,
        panelName: 'Contenido',
        createdBy: req.user!.userId,
        createdByName: userName,
        assignedTo: req.user!.userId,
        assignedToName: userName,
        status: 'PENDIENTE',
      });
      await taskRepo.save(newTask);
    } catch (taskErr) {
      console.error('Error creating automatic resync task:', taskErr);
    }
  }

  Object.assign(row, updates);
  const saved = await rowRepo().save(row);
  res.json(saved);
};

// DELETE /api/courses/:courseId/rows/:rowId
export const deleteRow = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canDelete) {
    res.status(403).json({ message: 'No tenés permisos para eliminar filas' });
    return;
  }

  const { courseId, rowId } = req.params;

  const row = await rowRepo().findOne({ where: { id: rowId, courseId } });
  if (!row) {
    res.status(404).json({ message: 'Fila no encontrada' });
    return;
  }

  await rowRepo().remove(row);
  res.json({ message: 'Fila eliminada correctamente' });
};

// PATCH /api/courses/:courseId/rows/reorder
export const reorderRows = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para reordenar filas' });
    return;
  }

  const { courseId } = req.params;
  const { orderedIds } = req.body as { orderedIds: string[] };

  if (!Array.isArray(orderedIds)) {
    res.status(400).json({ message: 'orderedIds debe ser un array' });
    return;
  }

  const updates = orderedIds.map((id, index) =>
    rowRepo().update({ id, courseId }, { sortOrder: index })
  );

  await Promise.all(updates);
  res.json({ message: 'Orden actualizado correctamente' });
};

// PATCH /api/courses/:courseId/materia  → rename materia en bulk
export const renameMateria = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para modificar materias' });
    return;
  }

  const { courseId } = req.params;
  const { oldName, newName } = req.body;

  if (!oldName || !newName) {
    res.status(400).json({ message: 'oldName y newName son requeridos' });
    return;
  }

  await rowRepo()
    .createQueryBuilder()
    .update()
    .set({ materia: newName })
    .where('courseId = :courseId AND materia = :oldName', { courseId, oldName })
    .execute();

  res.json({ message: 'Materia renombrada correctamente' });
};

// PATCH /api/courses/:courseId/modulo  → rename módulo en bulk
export const renameModulo = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para modificar módulos' });
    return;
  }

  const { courseId } = req.params;
  const { oldName, newName } = req.body;

  if (!oldName || !newName) {
    res.status(400).json({ message: 'oldName y newName son requeridos' });
    return;
  }

  await rowRepo()
    .createQueryBuilder()
    .update()
    .set({ modulo: newName })
    .where('courseId = :courseId AND modulo = :oldName', { courseId, oldName })
    .execute();

  res.json({ message: 'Módulo renombrado correctamente' });
};

// PATCH /api/courses/:courseId/modulo-numero  → set moduloNumero en bulk para un módulo
export const setModuloNumero = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para modificar módulos' });
    return;
  }

  const { courseId } = req.params;
  const { moduloName, numero } = req.body;

  if (!moduloName) {
    res.status(400).json({ message: 'moduloName es requerido' });
    return;
  }

  await rowRepo()
    .createQueryBuilder()
    .update()
    .set({ moduloNumero: numero ?? null })
    .where('courseId = :courseId AND modulo = :moduloName', { courseId, moduloName })
    .execute();

  res.json({ message: 'Número de clase actualizado correctamente' });
};

import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CourseRow } from '../entities/CourseRow';
import { Course } from '../entities/Course';

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

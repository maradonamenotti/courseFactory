import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { LibraryItem } from '../entities/LibraryItem';
import { Course } from '../entities/Course';
import { CourseRow } from '../entities/CourseRow';
import { Task } from '../entities/Task';

const libraryRepo = () => AppDataSource.getRepository(LibraryItem);
const courseRepo = () => AppDataSource.getRepository(Course);
const rowRepo = () => AppDataSource.getRepository(CourseRow);
const taskRepo = () => AppDataSource.getRepository(Task);

// GET /api/library
export const getLibraryItems = async (_req: Request, res: Response): Promise<void> => {
  const items = await libraryRepo().find({ order: { createdAt: 'DESC' } });
  res.json(items);
};

// GET /api/library/paginated?page=1&limit=20
export const getPaginatedLibraryItems = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const [data, total] = await libraryRepo().findAndCount({
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  res.json({
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
};

// POST /api/library
export const createLibraryItem = async (req: Request, res: Response): Promise<void> => {
  const { descripcion, formato, links, fileName, fileType, fileUrl } = req.body;

  if (!descripcion || !formato) {
    res.status(400).json({ message: 'Descripción y formato son requeridos' });
    return;
  }

  const item = libraryRepo().create({
    descripcion,
    formato,
    links: links || '',
    fileName: fileName || null,
    fileType: fileType || null,
    fileUrl: fileUrl || null,
  });

  const saved = await libraryRepo().save(item);
  res.status(201).json(saved);
};

// DELETE /api/library/:id
export const deleteLibraryItem = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const item = await libraryRepo().findOne({ where: { id } });
  if (!item) {
    res.status(404).json({ message: 'Ítem no encontrado' });
    return;
  }

  await libraryRepo().remove(item);
  res.json({ message: 'Ítem eliminado correctamente' });
};

// POST /api/library/:id/assign  → asignar a un curso
export const assignLibraryItem = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { courseId, materia, modulo } = req.body;

  if (!courseId || !materia || !modulo) {
    res.status(400).json({ message: 'courseId, materia y modulo son requeridos' });
    return;
  }

  const item = await libraryRepo().findOne({ where: { id } });
  if (!item) {
    res.status(404).json({ message: 'Ítem no encontrado' });
    return;
  }

  const course = await courseRepo().findOne({ where: { id: courseId } });
  if (!course) {
    res.status(404).json({ message: 'Curso no encontrado' });
    return;
  }

  // Contar rows actuales para sortOrder
  const count = await rowRepo().count({ where: { courseId } });

  // Crear nuevo CourseRow a partir del ítem
  const newRow = rowRepo().create({
    courseId,
    sortOrder: count,
    materia,
    modulo,
    descripcion: item.descripcion,
    formato: item.formato,
    links: item.links,
    fileName: item.fileName,
    fileType: item.fileType,
    fileUrl: item.fileUrl,
    // prefill por formato
    videoDrive: item.formato === 'VIDEO' ? item.links : '',
    geniallyUrl: item.formato === 'GENIALLY' ? item.links : '',
  });

  const savedRow = await rowRepo().save(newRow);

  // Mover tareas asociadas al ítem → al nuevo row
  await taskRepo()
    .createQueryBuilder()
    .update()
    .set({
      courseId,
      courseName: course.name,
      rowId: savedRow.id,
      rowNro: String(count + 1),
      rowModulo: modulo,
      panelName: 'Contenido',
    })
    .where('rowId = :id AND panelName = :panel', { id, panel: 'Biblioteca' })
    .execute();

  // Eliminar el ítem de la biblioteca
  await libraryRepo().remove(item);

  res.status(201).json(savedRow);
};

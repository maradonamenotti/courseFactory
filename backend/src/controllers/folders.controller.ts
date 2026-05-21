import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Folder } from '../entities/Folder';
import { Course } from '../entities/Course';

const folderRepo = () => AppDataSource.getRepository(Folder);
const courseRepo = () => AppDataSource.getRepository(Course);

// GET /api/folders
export const getFolders = async (_req: Request, res: Response): Promise<void> => {
  const folders = await folderRepo().find({ order: { createdAt: 'ASC' } });
  res.json(folders);
};

// POST /api/folders
export const createFolder = async (req: Request, res: Response): Promise<void> => {
  const { name, type, parentId } = req.body;

  if (!name || !type) {
    res.status(400).json({ message: 'Nombre y tipo son requeridos' });
    return;
  }

  if (!['carrera', 'licencia'].includes(type)) {
    res.status(400).json({ message: 'Tipo debe ser "carrera" o "licencia"' });
    return;
  }

  const folder = folderRepo().create({
    name: name.trim(),
    type,
    parentId: parentId || null,
  });

  const saved = await folderRepo().save(folder);
  res.status(201).json(saved);
};

// PUT /api/folders/:id
export const updateFolder = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, parentId } = req.body;

  const folder = await folderRepo().findOne({ where: { id } });
  if (!folder) {
    res.status(404).json({ message: 'Carpeta no encontrada' });
    return;
  }

  if (name) folder.name = name.trim();
  if (parentId !== undefined) folder.parentId = parentId || null;

  const saved = await folderRepo().save(folder);
  res.json(saved);
};

// DELETE /api/folders/:id  (en cascada: licencias hijas + cursos)
export const deleteFolder = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const folder = await folderRepo().findOne({ where: { id } });
  if (!folder) {
    res.status(404).json({ message: 'Carpeta no encontrada' });
    return;
  }

  // Si es carrera → buscar licencias hijas
  if (folder.type === 'carrera') {
    const licencias = await folderRepo().find({ where: { parentId: id, type: 'licencia' } });
    for (const lic of licencias) {
      // Eliminar cursos de cada licencia
      await courseRepo().delete({ folderId: lic.id });
    }
    // Eliminar las licencias
    await folderRepo().remove(licencias);
  }

  // Eliminar cursos directos de esta carpeta
  await courseRepo().delete({ folderId: id });

  // Eliminar la carpeta
  await folderRepo().remove(folder);
  res.json({ message: 'Carpeta eliminada correctamente' });
};

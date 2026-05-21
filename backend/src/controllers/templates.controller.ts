import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Template } from '../entities/Template';

const templateRepo = () => AppDataSource.getRepository(Template);

// GET /api/templates
export const getTemplates = async (_req: Request, res: Response): Promise<void> => {
  const templates = await templateRepo().find({ order: { createdAt: 'ASC' } });
  res.json(templates);
};

// POST /api/templates
export const createTemplate = async (req: Request, res: Response): Promise<void> => {
  const { name, design, blocks, customBlockCodes } = req.body;

  if (!name || !design || !blocks) {
    res.status(400).json({ message: 'Nombre, diseño y bloques son requeridos' });
    return;
  }

  const template = templateRepo().create({ name, design, blocks, customBlockCodes: customBlockCodes || null });
  const saved = await templateRepo().save(template);
  res.status(201).json(saved);
};

// PUT /api/templates/:id
export const updateTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const template = await templateRepo().findOne({ where: { id } });
  if (!template) {
    res.status(404).json({ message: 'Plantilla no encontrada' });
    return;
  }

  Object.assign(template, req.body);
  const saved = await templateRepo().save(template);
  res.json(saved);
};

// DELETE /api/templates/:id
export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const template = await templateRepo().findOne({ where: { id } });
  if (!template) {
    res.status(404).json({ message: 'Plantilla no encontrada' });
    return;
  }

  await templateRepo().remove(template);
  res.json({ message: 'Plantilla eliminada correctamente' });
};

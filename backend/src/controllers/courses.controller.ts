import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Course } from '../entities/Course';

const courseRepo = () => AppDataSource.getRepository(Course);

// GET /api/courses
export const getCourses = async (req: Request, res: Response): Promise<void> => {
  const { folderId } = req.query;

  const where = folderId ? { folderId: folderId as string } : {};
  const courses = await courseRepo().find({
    where,
    order: { createdAt: 'ASC' },
  });

  res.json(courses);
};

// POST /api/courses
export const createCourse = async (req: Request, res: Response): Promise<void> => {
  const { name, folderId } = req.body;

  if (!name) {
    res.status(400).json({ message: 'El nombre del curso es requerido' });
    return;
  }

  const course = courseRepo().create({
    name: name.trim(),
    folderId: folderId || null,
  });

  const saved = await courseRepo().save(course);
  res.status(201).json(saved);
};

// PUT /api/courses/:id
export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, folderId, languages } = req.body;

  const course = await courseRepo().findOne({ where: { id } });
  if (!course) {
    res.status(404).json({ message: 'Curso no encontrado' });
    return;
  }

  if (name) course.name = name.trim();
  if (folderId !== undefined) course.folderId = folderId || null;
  if (languages !== undefined) course.languages = languages;

  const saved = await courseRepo().save(course);
  res.json(saved);
};

// DELETE /api/courses/:id
export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const course = await courseRepo().findOne({ where: { id } });
  if (!course) {
    res.status(404).json({ message: 'Curso no encontrado' });
    return;
  }

  await courseRepo().remove(course); // rows eliminados en cascada por TypeORM
  res.json({ message: 'Curso eliminado correctamente' });
};

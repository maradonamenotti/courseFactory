import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Course } from '../entities/Course';
import { logUserActivity } from './reports.controller';
import { createMoodleCourse } from '../services/moodle.service';

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
  if (req.user?.userId) {
    await logUserActivity(req.user.userId, 'create_course', undefined, saved.id, `Curso creado: ${saved.name}`);
  }
  res.status(201).json(saved);
};

// PUT /api/courses/:id
export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, folderId, languages, moodleCourseId, moodleCourseName } = req.body;

  const course = await courseRepo().findOne({ where: { id } });
  if (!course) {
    res.status(404).json({ message: 'Curso no encontrado' });
    return;
  }

  if (name) course.name = name.trim();
  if (folderId !== undefined) course.folderId = folderId || null;
  if (languages !== undefined) course.languages = languages;
  if (moodleCourseId !== undefined) course.moodleCourseId = moodleCourseId || null;
  if (moodleCourseName !== undefined) course.moodleCourseName = moodleCourseName || null;

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
  if (req.user?.userId) {
    await logUserActivity(req.user.userId, 'delete_course', undefined, id, `Curso eliminado: ${course.name}`);
  }
  res.json({ message: 'Curso eliminado correctamente' });
};

// POST /api/courses/:id/moodle/create
export const createCourseInMoodle = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const course = await courseRepo().findOne({ where: { id } });
  if (!course) {
    res.status(404).json({ message: 'Curso no encontrado' });
    return;
  }

  try {
    // Generate a shortname by taking the name, lowercasing it, replacing spaces with dashes
    const shortname = course.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);
    const moodleCourse = await createMoodleCourse(course.name, shortname);
    
    course.moodleCourseId = moodleCourse.id.toString();
    course.moodleCourseName = course.name;
    
    const saved = await courseRepo().save(course);
    
    res.json(saved);
  } catch (error: any) {
    console.error('Moodle create error:', error);
    res.status(500).json({ message: error.message || 'Error al crear en Moodle' });
  }
};

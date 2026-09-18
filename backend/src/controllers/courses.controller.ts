import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Course } from '../entities/Course';
import { CourseRow } from '../entities/CourseRow';
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
  const { name, folderId, languages, moodleCourseId, moodleCourseName, releaseMode, startDate, prerequisiteCourseId, defaultViewMode } = req.body;

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
  if (releaseMode !== undefined) course.releaseMode = releaseMode;
  if (startDate !== undefined) course.startDate = startDate || null;
  if (prerequisiteCourseId !== undefined) course.prerequisiteCourseId = prerequisiteCourseId || null;
  if (defaultViewMode !== undefined) course.defaultViewMode = defaultViewMode || 'RELEASE_DATE';
  if (req.body.showClassBadges !== undefined) course.showClassBadges = req.body.showClassBadges;

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

// POST /api/courses/:id/duplicate
export const duplicateCourse = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name } = req.body;

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const courseRepoTrans = queryRunner.manager.getRepository(Course);
    const rowRepoTrans = queryRunner.manager.getRepository(CourseRow);

    const sourceCourse = await courseRepoTrans.findOne({ where: { id } });
    if (!sourceCourse) {
      res.status(404).json({ message: 'Curso no encontrado' });
      await queryRunner.rollbackTransaction();
      return;
    }

    const newName = name && name.trim() ? name.trim() : `${sourceCourse.name} (Copia)`;

    const duplicatedCourse = courseRepoTrans.create({
      name: newName,
      folderId: sourceCourse.folderId,
      languages: sourceCourse.languages,
      releaseMode: sourceCourse.releaseMode,
      startDate: sourceCourse.startDate,
      moodleCourseId: null,
      moodleCourseName: null,
    });

    const savedCourse = await courseRepoTrans.save(duplicatedCourse);

    const sourceRows = await rowRepoTrans.find({
      where: { courseId: id },
      order: { sortOrder: 'ASC' },
    });

    const duplicatedRows = sourceRows.map((row) => {
      const { id: _, courseId: __, course: ___, moodlePageId: ____, ...rest } = row;
      return rowRepoTrans.create({
        ...rest,
        courseId: savedCourse.id,
        course: savedCourse,
        moodlePageId: null,
      });
    });

    if (duplicatedRows.length > 0) {
      await rowRepoTrans.save(duplicatedRows);
    }

    if (req.user?.userId) {
      await logUserActivity(
        req.user.userId,
        'duplicate_course',
        undefined,
        savedCourse.id,
        `Curso duplicado: ${sourceCourse.name} -> ${savedCourse.name}`
      );
    }

    await queryRunner.commitTransaction();
    res.status(201).json(savedCourse);
  } catch (err: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error duplicando curso:', err);
    res.status(500).json({ message: err.message || 'Error interno al duplicar el curso' });
  } finally {
    await queryRunner.release();
  }
};

// POST /api/courses/:id/import-rows
export const importCourseRows = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params; // Target course ID
  const { sourceCourseId } = req.body;

  if (!sourceCourseId) {
    res.status(400).json({ message: 'Se requiere el parámetro sourceCourseId' });
    return;
  }

  if (id === sourceCourseId) {
    res.status(400).json({ message: 'El curso origen y el curso destino no pueden ser el mismo.' });
    return;
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const courseRepoTrans = queryRunner.manager.getRepository(Course);
    const rowRepoTrans = queryRunner.manager.getRepository(CourseRow);

    const targetCourse = await courseRepoTrans.findOne({ where: { id } });
    const sourceCourse = await courseRepoTrans.findOne({ where: { id: sourceCourseId } });

    if (!targetCourse || !sourceCourse) {
      res.status(404).json({ message: 'Curso origen o destino no encontrado' });
      await queryRunner.rollbackTransaction();
      return;
    }

    // Obtenemos el sortOrder máximo actual en el curso destino
    const targetRows = await rowRepoTrans.find({
      where: { courseId: id },
      order: { sortOrder: 'DESC' },
      take: 1
    });
    let maxSortOrder = targetRows.length > 0 ? targetRows[0].sortOrder : 0;

    // Obtenemos las filas del curso origen
    const sourceRows = await rowRepoTrans.find({
      where: { courseId: sourceCourseId },
      order: { sortOrder: 'ASC' }
    });

    const newRows = sourceRows.map((row) => {
      maxSortOrder += 1;
      const { id: _, courseId: __, course: ___, moodlePageId: ____, ...rest } = row;
      return rowRepoTrans.create({
        ...rest,
        courseId: id,
        course: targetCourse,
        moodlePageId: null,
        sortOrder: maxSortOrder
      });
    });

    if (newRows.length > 0) {
      await rowRepoTrans.save(newRows);
    }

    if (req.user?.userId) {
      await logUserActivity(
        req.user.userId,
        'import_course_rows',
        undefined,
        targetCourse.id,
        `Importadas ${newRows.length} clases de "${sourceCourse.name}" a "${targetCourse.name}"`
      );
    }

    await queryRunner.commitTransaction();
    res.json({
      message: `Se importaron ${newRows.length} clases correctamente de "${sourceCourse.name}".`,
      importedCount: newRows.length
    });
  } catch (err: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error importando clases de otro curso:', err);
    res.status(500).json({ message: err.message || 'Error interno al importar clases' });
  } finally {
    await queryRunner.release();
  }
};

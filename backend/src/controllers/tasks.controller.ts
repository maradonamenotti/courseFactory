import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Task } from '../entities/Task';

const taskRepo = () => AppDataSource.getRepository(Task);

// GET /api/tasks
export const getTasks = async (req: Request, res: Response): Promise<void> => {
  const { courseId, assignedTo, status, panelName } = req.query;

  const query = taskRepo().createQueryBuilder('task');

  if (courseId) query.andWhere('task.courseId = :courseId', { courseId });
  if (assignedTo) query.andWhere('task.assignedTo = :assignedTo', { assignedTo });
  if (status) query.andWhere('task.status = :status', { status });
  if (panelName) query.andWhere('task.panelName = :panelName', { panelName });

  query.orderBy('task.createdAt', 'DESC');

  const tasks = await query.getMany();
  res.json(tasks);
};

// GET /api/tasks/paginated?page=1&limit=20&courseId=...&assignedTo=...&status=...&panelName=...
export const getPaginatedTasks = async (req: Request, res: Response): Promise<void> => {
  const { courseId, assignedTo, status, panelName } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const query = taskRepo().createQueryBuilder('task');

  if (courseId) query.andWhere('task.courseId = :courseId', { courseId });
  if (assignedTo) query.andWhere('task.assignedTo = :assignedTo', { assignedTo });
  if (status) query.andWhere('task.status = :status', { status });
  if (panelName) query.andWhere('task.panelName = :panelName', { panelName });

  query.orderBy('task.createdAt', 'DESC');
  query.skip((page - 1) * limit).take(limit);

  const [data, total] = await query.getManyAndCount();

  res.json({
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
};

// POST /api/tasks
export const createTask = async (req: Request, res: Response): Promise<void> => {
  const { title, description, courseId, courseName, rowId, rowNro, rowModulo, panelName, assignedTo, assignedToName, dueDate } = req.body;

  if (!title || !panelName || !assignedTo || !assignedToName) {
    res.status(400).json({ message: 'Título, panel, y asignado son requeridos' });
    return;
  }

  const task = taskRepo().create({
    title,
    description: description || '',
    courseId: courseId || null,
    courseName: courseName || null,
    rowId: rowId || null,
    rowNro: rowNro || null,
    rowModulo: rowModulo || null,
    panelName,
    createdBy: req.user!.userId,
    createdByName: req.body.createdByName || '',
    assignedTo,
    assignedToName,
    status: 'PENDIENTE',
    dueDate: dueDate || null,
  });

  const saved = await taskRepo().save(task);
  res.status(201).json(saved);
};

// PUT /api/tasks/:id
export const updateTask = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const task = await taskRepo().findOne({ where: { id } });
  if (!task) {
    res.status(404).json({ message: 'Tarea no encontrada' });
    return;
  }

  Object.assign(task, req.body);
  const saved = await taskRepo().save(task);
  res.json(saved);
};

// PATCH /api/tasks/:id/status  → ciclar estado
export const cycleTaskStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const task = await taskRepo().findOne({ where: { id } });
  if (!task) {
    res.status(404).json({ message: 'Tarea no encontrada' });
    return;
  }

  const cycle: Record<string, string> = {
    PENDIENTE: 'EN_PROCESO',
    EN_PROCESO: 'RESUELTO',
    RESUELTO: 'PENDIENTE',
  };

  task.status = cycle[task.status] || 'PENDIENTE';
  const saved = await taskRepo().save(task);
  res.json(saved);
};

// DELETE /api/tasks/:id
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const task = await taskRepo().findOne({ where: { id } });
  if (!task) {
    res.status(404).json({ message: 'Tarea no encontrada' });
    return;
  }

  await taskRepo().remove(task);
  res.json({ message: 'Tarea eliminada correctamente' });
};

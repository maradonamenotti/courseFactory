import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Task } from '../entities/Task';
import { User } from '../entities/User';
import { sendTaskAlertEmail } from '../services/email.service';

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

  // Enviar alerta por email asíncronamente
  try {
    const userRepo = AppDataSource.getRepository(User);
    userRepo.findOne({ where: { id: assignedTo } }).then((assignedUser) => {
      if (assignedUser && assignedUser.email) {
        sendTaskAlertEmail(
          assignedUser.email,
          assignedUser.name,
          title,
          description || '',
          courseName || undefined,
          panelName
        ).catch(err => console.error('Error enviando mail de tarea:', err));
      }
    }).catch(err => console.error('Error buscando usuario asignado para email:', err));
  } catch (err) {
    console.error('Error al iniciar envío de email:', err);
  }

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

  const oldAssignedTo = task.assignedTo;
  Object.assign(task, req.body);
  const saved = await taskRepo().save(task);

  // Si cambió la asignación, notificar al nuevo asignado por email
  if (req.body.assignedTo && req.body.assignedTo !== oldAssignedTo) {
    try {
      const userRepo = AppDataSource.getRepository(User);
      userRepo.findOne({ where: { id: req.body.assignedTo } }).then((assignedUser) => {
        if (assignedUser && assignedUser.email) {
          sendTaskAlertEmail(
            assignedUser.email,
            assignedUser.name,
            saved.title,
            saved.description || '',
            saved.courseName || undefined,
            saved.panelName
          ).catch(err => console.error('Error enviando mail de tarea:', err));
        }
      }).catch(err => console.error('Error buscando usuario asignado para email:', err));
    } catch (err) {
      console.error('Error al iniciar envío de email:', err);
    }
  }

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

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

const userRepo = () => AppDataSource.getRepository(User);

const DEFAULT_PASSWORD = 'Maradona2026';

// GET /api/users
export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await userRepo().find({ order: { createdAt: 'ASC' } });
  const safeUsers = users.map(({ passwordHash, ...u }) => { void passwordHash; return u; });
  res.json(safeUsers);
};

// POST /api/users
export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { email, name, role, isAdmin, allowedPanels } = req.body;

  if (!email || !name || !role) {
    res.status(400).json({ message: 'Email, nombre y rol son requeridos' });
    return;
  }

  const existing = await userRepo().findOne({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    res.status(409).json({ message: 'Ya existe un usuario con ese email' });
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const user = userRepo().create({
    email: email.toLowerCase().trim(),
    name,
    role,
    isAdmin: isAdmin || false,
    allowedPanels: allowedPanels || [],
    passwordHash,
    mustChangePassword: true,
  });

  const saved = await userRepo().save(user);
  const { passwordHash: _, ...safeUser } = saved;
  void _;
  res.status(201).json(safeUser);
};

// PUT /api/users/:id
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, role, isAdmin, allowedPanels } = req.body;

  const user = await userRepo().findOne({ where: { id } });
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado' });
    return;
  }

  if (name) user.name = name;
  if (role) user.role = role;
  if (isAdmin !== undefined) user.isAdmin = isAdmin;
  if (allowedPanels) user.allowedPanels = allowedPanels;

  const saved = await userRepo().save(user);
  const { passwordHash, ...safeUser } = saved;
  void passwordHash;
  res.json(safeUser);
};

// DELETE /api/users/:id
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === req.user!.userId) {
    res.status(400).json({ message: 'No podés eliminar tu propio usuario' });
    return;
  }

  const user = await userRepo().findOne({ where: { id } });
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado' });
    return;
  }

  await userRepo().remove(user);
  res.json({ message: 'Usuario eliminado correctamente' });
};

// PATCH /api/users/:id/reset-password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const user = await userRepo().findOne({ where: { id } });
  if (!user) {
    res.status(404).json({ message: 'Usuario no encontrado' });
    return;
  }

  user.passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  user.mustChangePassword = true;
  await userRepo().save(user);

  res.json({ message: `Contraseña reseteada a la default para ${user.name}` });
};

import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { UnlockCode } from '../entities/UnlockCode';
import { logUserActivity } from './reports.controller';

const codeRepo = () => AppDataSource.getRepository(UnlockCode);

// GET /api/courses/:courseId/unlock-codes
export const getUnlockCodes = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;

  try {
    const codes = await codeRepo().find({
      where: { courseId },
      order: { createdAt: 'DESC' },
    });
    res.json(codes);
  } catch (error: any) {
    console.error('Error fetching unlock codes:', error);
    res.status(500).json({ message: error.message || 'Error al obtener los códigos' });
  }
};

// POST /api/courses/:courseId/unlock-codes
export const createUnlockCode = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;
  const { code, type, targetMateria, maxUses, expiresAt } = req.body;

  if (!code) {
    res.status(400).json({ message: 'El código de desbloqueo es requerido' });
    return;
  }

  try {
    const cleanedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    // Verificar si ya existe el código
    const existing = await codeRepo().findOne({ where: { code: cleanedCode } });
    if (existing) {
      res.status(400).json({ message: `El código "${cleanedCode}" ya existe. Elige otro.` });
      return;
    }

    const newCode = codeRepo().create({
      code: cleanedCode,
      type: type || 'TOTAL',
      targetMateria: type === 'PARTIAL' ? targetMateria : null,
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      courseId,
      usedCount: 0,
    });

    const saved = await codeRepo().save(newCode);

    if (req.user?.userId) {
      await logUserActivity(req.user.userId, 'create_unlock_code', undefined, courseId, `Código creado: ${saved.code} (${saved.type})`);
    }

    res.status(201).json(saved);
  } catch (error: any) {
    console.error('Error creating unlock code:', error);
    res.status(500).json({ message: error.message || 'Error al crear el código' });
  }
};

// DELETE /api/courses/:courseId/unlock-codes/:id
export const deleteUnlockCode = async (req: Request, res: Response): Promise<void> => {
  const { courseId, id } = req.params;

  try {
    const codeObj = await codeRepo().findOne({ where: { id, courseId } });
    if (!codeObj) {
      res.status(404).json({ message: 'Código no encontrado' });
      return;
    }

    await codeRepo().remove(codeObj);

    if (req.user?.userId) {
      await logUserActivity(req.user.userId, 'delete_unlock_code', undefined, courseId, `Código eliminado: ${codeObj.code}`);
    }

    res.json({ message: 'Código eliminado correctamente' });
  } catch (error: any) {
    console.error('Error deleting unlock code:', error);
    res.status(500).json({ message: error.message || 'Error al eliminar el código' });
  }
};

import { Router } from 'express';
import {
  getRows,
  createRow,
  updateRow,
  deleteRow,
  reorderRows,
  renameMateria,
  renameModulo,
  setModuloNumero,
} from '../controllers/rows.controller';
import { requireAuth, requireFullAccess } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth, requireFullAccess);

// Rutas de rows dentro de un curso
router.get('/:courseId/rows', getRows);
router.post('/:courseId/rows', createRow);
router.patch('/:courseId/rows/reorder', reorderRows);
router.put('/:courseId/rows/:rowId', updateRow);
router.delete('/:courseId/rows/:rowId', deleteRow);

// Bulk rename / update
router.patch('/:courseId/materia', renameMateria);
router.patch('/:courseId/modulo', renameModulo);
router.patch('/:courseId/modulo-numero', setModuloNumero);

export default router;

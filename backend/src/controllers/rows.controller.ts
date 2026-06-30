import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CourseRow } from '../entities/CourseRow';
import { Course } from '../entities/Course';
import { RowHistory } from '../entities/RowHistory';
import { User } from '../entities/User';
import { Task } from '../entities/Task';
import { logUserActivity } from './reports.controller';
import { getBypassToken } from './preview.controller';


// Campos que pertenecen a cada panel (para determinar el panel del cambio)
const PANEL_FIELDS: Record<number, string[]> = {
  1: ['materia', 'modulo', 'moduloNumero', 'descripcion', 'formato', 'links', 'fileName', 'fileType', 'fileUrl', 'htmlContent', 'estado', 'fechaDisponibilidad'],
  2: ['videoDrive', 'videoVimeo', 'videoSubtitulos', 'geniallyUrl', 'geniallyLinkStatus', 'geniallyTextoStatus', 'geniallyDisenoStatus', 'estadoMultimedia', 'meetLink', 'meetDateTime', 'meetDescripcion'],
  3: ['aprobacionContenido', 'aprobacionMultimedia', 'comentariosRevisor', 'estadoFinal', 'aprobacionDiseno', 'aprobacionTraduccion'],
};

function detectPanel(changedFields: string[]): number {
  for (const panel of [1, 2, 3]) {
    if (changedFields.some((f) => PANEL_FIELDS[panel].includes(f))) return panel;
  }
  return 1;
}

// Genera una descripción legible de los cambios
function buildDescription(changedFields: string[], before: Record<string, unknown>, after: Record<string, unknown>): string {
  return changedFields
    .map((field) => {
      const prev = String(before[field] ?? '');
      const next = String(after[field] ?? '');
      return `${field}: "${prev}" → "${next}"`;
    })
    .join(' | ');
}

const rowRepo = () => AppDataSource.getRepository(CourseRow);
const courseRepo = () => AppDataSource.getRepository(Course);

// GET /api/courses/:courseId/rows
export const getRows = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;

  const rows = await rowRepo().find({
    where: { courseId },
    order: { sortOrder: 'ASC' },
  });

  const enriched = rows.map((r) => ({
    ...r,
    bypassToken: getBypassToken(r.id),
  }));

  res.json(enriched);
};

// POST /api/courses/:courseId/rows
export const createRow = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para realizar modificaciones' });
    return;
  }

  const { courseId } = req.params;

  const course = await courseRepo().findOne({ where: { id: courseId } });
  if (!course) {
    res.status(404).json({ message: 'Curso no encontrado' });
    return;
  }

  // Calcular sortOrder máximo actual
  const count = await rowRepo().count({ where: { courseId } });

  const row = rowRepo().create({
    ...req.body,
    courseId,
    sortOrder: count,
  }) as any;

  const saved = await rowRepo().save(row);
  if (req.user?.userId) {
    await logUserActivity(req.user.userId, 'create_row', 'Contenido', courseId, `Fila creada en materia ${saved.materia}, módulo ${saved.modulo}`);
  }
  res.status(201).json({
    ...saved,
    bypassToken: getBypassToken(saved.id),
  });
};

// PUT /api/courses/:courseId/rows/:rowId
export const updateRow = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para realizar modificaciones' });
    return;
  }

  const { courseId, rowId } = req.params;

  const row = await rowRepo().findOne({ where: { id: rowId, courseId } });
  if (!row) {
    res.status(404).json({ message: 'Fila no encontrada' });
    return;
  }

  // Lógica de sincronización bidireccional (igual que en el frontend)
  const updates = { ...req.body };

  if (updates.links !== undefined) {
    if (row.formato === 'VIDEO') updates.videoDrive = updates.links;
    else if (row.formato === 'GENIALLY') updates.geniallyUrl = updates.links;
  }
  if (updates.videoDrive !== undefined && row.formato === 'VIDEO') {
    updates.links = updates.videoDrive;
  }
  if (updates.geniallyUrl !== undefined && row.formato === 'GENIALLY') {
    updates.links = updates.geniallyUrl;
  }

  // ── Historial: snapshot ANTES del cambio ─────────────────────────────────
  const snapshot: Record<string, unknown> = { ...(row as unknown as Record<string, unknown>) };

  const changedFields = Object.keys(updates).filter((key) => {
    const rowRecord = row as unknown as Record<string, unknown>;
    return key in rowRecord && String(rowRecord[key]) !== String(updates[key]);
  });

  if (changedFields.length > 0) {
    const updatesRecord = updates as Record<string, unknown>;
    const historyRepo = AppDataSource.getRepository(RowHistory);
    const userRepo = AppDataSource.getRepository(User);
    const dbUser = await userRepo.findOne({ where: { id: req.user!.userId } });
    const userName = dbUser?.name || req.user!.role || 'Usuario desconocido';

    const panelNum = detectPanel(changedFields);
    const panelName = panelNum === 1 ? 'Contenido' : panelNum === 2 ? 'Multimedia' : panelNum === 3 ? 'Verificación' : undefined;

    const historyEntry = historyRepo.create({
      rowId,
      courseId,
      userId: req.user!.userId,
      userName,
      changedFields,
      description: buildDescription(changedFields, snapshot, updatesRecord),
      panel: panelNum,
      snapshot,
    });
    await historyRepo.save(historyEntry);

    if (req.user?.userId) {
      await logUserActivity(req.user.userId, 'edit_row', panelName, courseId, `Campos modificados: ${changedFields.join(', ')}`);
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Create auto-task alert on Google Drive resync
  const wasGoogleDoc = !!row.googleFileId;
  if (wasGoogleDoc && updates.googleLastSyncedAt !== undefined) {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const dbUser = await userRepo.findOne({ where: { id: req.user!.userId } });
      const userName = dbUser?.name || req.user!.role || 'Usuario';

      const courseRepo = AppDataSource.getRepository(Course);
      const course = await courseRepo.findOne({ where: { id: courseId } });

      const taskRepo = AppDataSource.getRepository(Task);
      const newTask = taskRepo.create({
        title: `⚠️ Archivo de Drive actualizado: Clase ${row.sortOrder + 1}`,
        description: `El archivo de Google Drive "${updates.fileName || row.fileName || 'documento'}" fue actualizado e importado de nuevo.\n\nUbicación:\n- Curso: ${course?.name || 'Desconocido'}\n- Materia: ${row.materia}\n- Clase: ${row.modulo || 'Sin clase'}\n- Posición: ${row.sortOrder + 1}`,
        courseId,
        courseName: course?.name || null,
        rowId,
        rowNro: String(row.sortOrder + 1),
        rowModulo: row.modulo,
        panelName: 'Contenido',
        createdBy: req.user!.userId,
        createdByName: userName,
        assignedTo: req.user!.userId,
        assignedToName: userName,
        status: 'PENDIENTE',
      });
      await taskRepo.save(newTask);
    } catch (taskErr) {
      console.error('Error creating automatic resync task:', taskErr);
    }
  }

  // ── Moodle Auto-Sync Trigger ─────────────────────────────────────────────
  // Solo publicar cuando se APRUEBA el diseño. Si se desaprueba (PENDIENTE),
  // NO publicar — el contenido permanece en Moodle como estaba hasta la próxima aprobación.
  const isApproving = updates.aprobacionDiseno === 'APROBADO';
  const isRegeneratingApproved = (row.aprobacionDiseno === 'APROBADO') && updates.generatedHtml !== undefined;

  let moodlePublished = false;
  let moodleError: string | null = null;
  let moodleConfigured = false;

  if (isApproving || isRegeneratingApproved) {
    try {
      const courseRepo = AppDataSource.getRepository(Course);
      const course = await courseRepo.findOne({ where: { id: courseId } });
      if (course && course.moodleCourseId) {
        moodleConfigured = true;
        const htmlToPublish = updates.generatedHtml !== undefined ? updates.generatedHtml : row.generatedHtml;
        if (htmlToPublish) {
          const moodleUrl = process.env.MOODLE_URL;
          const moodleToken = process.env.MOODLE_TOKEN;
          if (moodleUrl && moodleToken) {
            const cleanUrl = moodleUrl.endsWith('/') ? moodleUrl.slice(0, -1) : moodleUrl;
            const endpoint = `${cleanUrl}/webservice/rest/server.php`;
            const params = new URLSearchParams({
              wstoken: moodleToken,
              wsfunction: 'core_course_update_courses',
              moodlewsrestformat: 'json',
              'courses[0][shortname]': course.moodleCourseId,
              'courses[0][fullname]': course.moodleCourseName || course.name,
              'courses[0][summary]': htmlToPublish,
              'courses[0][summaryformat]': '1',
            });
            const moodleRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params
            });
            const responseText = await moodleRes.text();
            console.log('[Moodle Auto-Sync] Response:', responseText);
            // Moodle returns null or [] on success, or {exception:...} on error
            try {
              const parsed = JSON.parse(responseText);
              if (parsed && parsed.exception) {
                moodleError = parsed.message || parsed.exception;
              } else {
                moodlePublished = true;
              }
            } catch {
              // Non-JSON response usually means success (Moodle quirk)
              moodlePublished = true;
            }
          }
        }
      }
    } catch (moodleErr) {
      console.error('[Moodle Auto-Sync] Error:', moodleErr);
      moodleError = moodleErr instanceof Error ? moodleErr.message : 'Error desconocido';
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Propagar fechaDisponibilidad a todas las filas del mismo módulo en este curso
  if (updates.fechaDisponibilidad !== undefined && row.modulo) {
    await rowRepo().update(
      { courseId, modulo: row.modulo },
      { fechaDisponibilidad: updates.fechaDisponibilidad }
    );
  }

  Object.assign(row, updates);
  const saved = await rowRepo().save(row);
  // Incluir resultado Moodle en la respuesta para que el frontend pueda mostrar confirmación
  res.json({
    ...saved,
    bypassToken: getBypassToken(saved.id),
    _moodle: { published: moodlePublished, error: moodleError, configured: moodleConfigured }
  });
};

// DELETE /api/courses/:courseId/rows/:rowId
export const deleteRow = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canDelete) {
    res.status(403).json({ message: 'No tenés permisos para eliminar filas' });
    return;
  }

  const { courseId, rowId } = req.params;

  const row = await rowRepo().findOne({ where: { id: rowId, courseId } });
  if (!row) {
    res.status(404).json({ message: 'Fila no encontrada' });
    return;
  }

  await rowRepo().remove(row);
  if (req.user?.userId) {
    await logUserActivity(req.user.userId, 'delete_row', undefined, courseId, `Fila eliminada: materia ${row.materia}, módulo ${row.modulo}`);
  }
  res.json({ message: 'Fila eliminada correctamente' });
};

// PATCH /api/courses/:courseId/rows/reorder
export const reorderRows = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para reordenar filas' });
    return;
  }

  const { courseId } = req.params;
  const { orderedIds } = req.body as { orderedIds: string[] };

  if (!Array.isArray(orderedIds)) {
    res.status(400).json({ message: 'orderedIds debe ser un array' });
    return;
  }

  const updates = orderedIds.map((id, index) =>
    rowRepo().update({ id, courseId }, { sortOrder: index })
  );

  await Promise.all(updates);
  res.json({ message: 'Orden actualizado correctamente' });
};

// PATCH /api/courses/:courseId/materia  → rename materia en bulk
export const renameMateria = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para modificar materias' });
    return;
  }

  const { courseId } = req.params;
  const { oldName, newName } = req.body;

  if (!oldName || !newName) {
    res.status(400).json({ message: 'oldName y newName son requeridos' });
    return;
  }

  await rowRepo()
    .createQueryBuilder()
    .update()
    .set({ materia: newName })
    .where('courseId = :courseId AND materia = :oldName', { courseId, oldName })
    .execute();

  res.json({ message: 'Materia renombrada correctamente' });
};

// PATCH /api/courses/:courseId/modulo  → rename módulo en bulk
export const renameModulo = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para modificar módulos' });
    return;
  }

  const { courseId } = req.params;
  const { oldName, newName } = req.body;

  if (!oldName || !newName) {
    res.status(400).json({ message: 'oldName y newName son requeridos' });
    return;
  }

  await rowRepo()
    .createQueryBuilder()
    .update()
    .set({ modulo: newName })
    .where('courseId = :courseId AND modulo = :oldName', { courseId, oldName })
    .execute();

  res.json({ message: 'Módulo renombrado correctamente' });
};

// PATCH /api/courses/:courseId/modulo-numero  → set moduloNumero en bulk para un módulo
export const setModuloNumero = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.isAdmin && !req.user?.canEdit) {
    res.status(403).json({ message: 'No tenés permisos para modificar módulos' });
    return;
  }

  const { courseId } = req.params;
  const { moduloName, numero } = req.body;

  if (!moduloName) {
    res.status(400).json({ message: 'moduloName es requerido' });
    return;
  }

  await rowRepo()
    .createQueryBuilder()
    .update()
    .set({ moduloNumero: numero ?? null })
    .where('courseId = :courseId AND modulo = :moduloName', { courseId, moduloName })
    .execute();

  res.json({ message: 'Número de clase actualizado correctamente' });
};

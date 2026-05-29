import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { TrackingEvent } from '../entities/TrackingEvent';

export const getDashboardReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const trackingRepo = AppDataSource.getRepository(TrackingEvent);

    // 1. KPI Cards
    const totalAccesses = await trackingRepo.count();
    
    const uniqueStudentsRes = await trackingRepo
      .createQueryBuilder('event')
      .select('COUNT(DISTINCT event.alumnoMoodleId)', 'count')
      .getRawOne();
    const uniqueStudents = parseInt(uniqueStudentsRes?.count || '0', 10);

    const completedClasses = await trackingRepo.count({
      where: { accion: 'finish' }
    });

    // 2. Agrupamiento Comercial (total de interacciones por licencia y materia)
    const commercialUsage = await trackingRepo
      .createQueryBuilder('event')
      .select('MAX(event.licencia)', 'licencia')
      .addSelect('MAX(event.materia)', 'materia')
      .addSelect('COUNT(*)', 'total_interactions')
      .groupBy('UPPER(event.licencia)')
      .addGroupBy('UPPER(event.materia)')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    const mappedCommercialUsage = commercialUsage.map(c => ({
      licencia: c.licencia ? c.licencia.toUpperCase() : '',
      materia: c.materia,
      totalInteractions: parseInt(c.total_interactions || '0', 10)
    }));

    // 3. Embudo de Retención (Funnel por Clase)
    const retentionFunnel = await trackingRepo
      .createQueryBuilder('event')
      .select('event.modulo', 'modulo')
      .addSelect("SUM(CASE WHEN event.accion = 'open' THEN 1 ELSE 0 END)", 'open')
      .addSelect("SUM(CASE WHEN event.accion = 'click_continuar' THEN 1 ELSE 0 END)", 'click_continuar')
      .addSelect("SUM(CASE WHEN event.accion = 'finish' THEN 1 ELSE 0 END)", 'finish')
      .groupBy('event.modulo')
      .getRawMany();

    const mappedRetentionFunnel = retentionFunnel.map(f => ({
      modulo: f.modulo,
      open: parseInt(f.open || '0', 10),
      click_continuar: parseInt(f.click_continuar || '0', 10),
      finish: parseInt(f.finish || '0', 10)
    }));

    // 4. Avance por Alumno
    const studentProgressRaw = await trackingRepo
      .createQueryBuilder('event')
      .select('event.alumnoMoodleId', 'alumno_id')
      .addSelect('MAX(event.alumnoNombre)', 'alumno_nombre')
      .addSelect('MAX(event.licencia)', 'licencia')
      .addSelect('MAX(event.materia)', 'materia')
      .addSelect("COUNT(DISTINCT CASE WHEN event.accion = 'open' THEN event.modulo END)", 'started_classes')
      .addSelect("COUNT(DISTINCT CASE WHEN event.accion = 'finish' THEN event.modulo END)", 'completed_classes')
      .addSelect('MAX(event.timestamp)', 'last_activity')
      .groupBy('event.alumnoMoodleId')
      .addGroupBy('UPPER(event.licencia)')
      .addGroupBy('UPPER(event.materia)')
      .orderBy('MAX(event.timestamp)', 'DESC')
      .getRawMany();

    const studentProgress = studentProgressRaw.map(s => ({
      alumnoId: s.alumno_id,
      alumnoNombre: s.alumno_nombre,
      licencia: s.licencia ? s.licencia.toUpperCase() : '',
      materia: s.materia,
      startedClasses: parseInt(s.started_classes || '0', 10),
      completedClasses: parseInt(s.completed_classes || '0', 10),
      lastActivity: s.last_activity
    }));

    res.json({
      kpis: {
        totalAccesses,
        uniqueStudents,
        completedClasses
      },
      commercialUsage: mappedCommercialUsage,
      retentionFunnel: mappedRetentionFunnel,
      studentProgress
    });
  } catch (error) {
    console.error('Error fetching dashboard reports:', error);
    res.status(500).json({ message: 'Error interno al generar reporte de analítica' });
  }
};

export const createTrackingEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { licencia, materia, modulo, accion, alumnoMoodleId, alumnoNombre } = req.body;

    if (!licencia || !materia || !modulo || !accion || !alumnoMoodleId) {
      res.status(400).json({ message: 'Faltan campos requeridos en el evento' });
      return;
    }

    const trackingRepo = AppDataSource.getRepository(TrackingEvent);
    
    const event = new TrackingEvent();
    event.licencia = licencia;
    event.materia = materia;
    event.modulo = modulo;
    event.accion = accion;
    event.alumnoMoodleId = alumnoMoodleId;
    event.alumnoNombre = alumnoNombre || null;

    await trackingRepo.save(event);

    res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('Error saving tracking event:', error);
    res.status(500).json({ message: 'Error interno al guardar evento de analítica' });
  }
};

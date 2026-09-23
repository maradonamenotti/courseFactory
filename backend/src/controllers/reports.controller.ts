import { Request, Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { TrackingEvent } from '../entities/TrackingEvent';
import { User } from '../entities/User';
import { UserActivity } from '../entities/UserActivity';
import { StudentResourceProgress } from '../entities/StudentResourceProgress';
import { StudentTimeStats } from '../entities/StudentTimeStats';
import { CourseRow } from '../entities/CourseRow';
import { StudentExamAttempt } from '../entities/StudentExamAttempt';
import { CoursePreview } from '../entities/CoursePreview';
import { Course } from '../entities/Course';
import { StudentUnlockOverride } from '../entities/StudentUnlockOverride';
import { getMoodleCoursesList, getMoodleEnrolledUsers, getMoodleStudentGrades, getMoodleUsersByIds, resolveNumericMoodleCourseId } from '../services/moodle.service';
import { isMoodleItemMatchingRow } from './preview.controller';


const resolveStudentNames = async (studentProgressList: Array<{ alumnoId: string; alumnoNombre: string | null }>) => {
  const idsToFetch: string[] = [];
  studentProgressList.forEach(s => {
    const isGeneric = !s.alumnoNombre || s.alumnoNombre === 'Alumno de Moodle' || s.alumnoNombre === 'Alumno Moodle' || s.alumnoNombre === 'alumno_anonimo' || s.alumnoNombre === s.alumnoId;
    if (isGeneric && s.alumnoId) {
      idsToFetch.push(s.alumnoId);
    }
  });

  if (idsToFetch.length > 0) {
    try {
      const userMap = await getMoodleUsersByIds(idsToFetch);
      if (userMap.size > 0) {
        studentProgressList.forEach(s => {
          const resolved = userMap.get(s.alumnoId);
          if (resolved && resolved.fullname) {
            s.alumnoNombre = resolved.fullname;
          }
        });

        // Persistir en segundo plano en la BD para que las futuras consultas queden ya guardadas
        (async () => {
          try {
            const trackingRepo = AppDataSource.getRepository(TrackingEvent);
            const progressRepo = AppDataSource.getRepository(StudentResourceProgress);

            for (const [rawId, info] of userMap.entries()) {
              if (info.fullname) {
                await trackingRepo.update(
                  { alumnoMoodleId: rawId },
                  { alumnoNombre: info.fullname }
                );
                await progressRepo.update(
                  { alumnoMoodleId: rawId },
                  { alumnoNombre: info.fullname }
                );
              }
            }
          } catch (e) {
            console.error('Error persisting resolved student names in DB:', e);
          }
        })();
      }
    } catch (e) {
      console.error('Error resolving student names from Moodle:', e);
    }
  }
};

export const getDashboardReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, dateRange, startDate, endDate } = req.query as {
      courseId?: string;
      dateRange?: string;
      startDate?: string;
      endDate?: string;
    };
    const trackingRepo = AppDataSource.getRepository(TrackingEvent);

    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (dateRange === 'today') {
      startDateObj = todayStart;
      endDateObj = todayEnd;
    } else if (dateRange === 'yesterday') {
      const yStart = new Date(todayStart);
      yStart.setDate(yStart.getDate() - 1);
      const yEnd = new Date(todayEnd);
      yEnd.setDate(yEnd.getDate() - 1);
      startDateObj = yStart;
      endDateObj = yEnd;
    } else if (dateRange === 'last7days') {
      const d7 = new Date(todayStart);
      d7.setDate(d7.getDate() - 6);
      startDateObj = d7;
      endDateObj = todayEnd;
    } else if (dateRange === 'last30days') {
      const d30 = new Date(todayStart);
      d30.setDate(d30.getDate() - 29);
      startDateObj = d30;
      endDateObj = todayEnd;
    } else if (dateRange === 'thisMonth') {
      startDateObj = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDateObj = todayEnd;
    } else if (dateRange === 'custom' && startDate) {
      startDateObj = new Date(`${startDate}T00:00:00`);
      if (endDate) {
        endDateObj = new Date(`${endDate}T23:59:59`);
      } else {
        endDateObj = todayEnd;
      }
    }

    if (courseId) {
      // 1. KPIs
      const totalAccesses = await trackingRepo.count({ where: { courseId } });
      
      const uniqueStudentsRes = await trackingRepo
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT event.alumnoMoodleId)', 'count')
        .where('event.courseId = :courseId', { courseId })
        .getRawOne();
      const uniqueStudents = parseInt(uniqueStudentsRes?.count || '0', 10);

      // Clases finalizadas totales (suma de todas las clases finalizadas de todos los alumnos)
      const progressRepo = AppDataSource.getRepository(StudentResourceProgress);
      const rowRepo = AppDataSource.getRepository(CourseRow);
      
      const rows = await rowRepo.find({
        where: { courseId },
        order: { sortOrder: 'ASC' }
      });

      // Resolver duraciones de videos que falten en una sola pasada inicial
      const videoRows = rows.filter(r => r.formato === 'VIDEO' && r.videoVimeo && !r.videoDuration);
      if (videoRows.length > 0) {
        await Promise.all(
          videoRows.map(async (r) => {
            try {
              let videoUrl = r.videoVimeo.trim();
              if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
                videoUrl = `https://vimeo.com/${videoUrl}`;
              }
              const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`);
              if (res.ok) {
                const data = await res.json() as any;
                if (data && typeof data.duration === 'number') {
                  r.videoDuration = data.duration;
                  await rowRepo.update(r.id, { videoDuration: data.duration });
                }
              }
            } catch (e) {
              console.error(`Error resolving initial vimeo duration for row ${r.id}:`, e);
            }
          })
        );
      }

      const moduloResourceCounts = new Map<string, number>();
      rows.forEach(r => {
        const mod = r.modulo || 'Sin clase';
        moduloResourceCounts.set(mod, (moduloResourceCounts.get(mod) || 0) + 1);
      });

      const progressRows = await progressRepo.find({ where: { courseId } });

      const studentModuleProgress = new Map<string, { name: string; modulos: Map<string, Set<string>> }>();
      progressRows.forEach(p => {
        if (!studentModuleProgress.has(p.alumnoMoodleId)) {
          studentModuleProgress.set(p.alumnoMoodleId, {
            name: p.alumnoNombre || 'Alumno Moodle',
            modulos: new Map<string, Set<string>>()
          });
        }
        const studentData = studentModuleProgress.get(p.alumnoMoodleId)!;
        if (p.alumnoNombre && p.alumnoNombre !== 'Alumno de Moodle' && p.alumnoNombre !== 'Alumno Moodle' && p.alumnoNombre !== 'alumno_anonimo') {
          if (studentData.name === 'Alumno Moodle' || studentData.name === 'Alumno de Moodle' || studentData.name === 'alumno_anonimo' || !studentData.name) {
            studentData.name = p.alumnoNombre;
          }
        }
        const mod = p.modulo || 'Sin clase';
        if (!studentData.modulos.has(mod)) {
          studentData.modulos.set(mod, new Set<string>());
        }
        studentData.modulos.get(mod)!.add(p.rowId);
      });

      let completedClassesTotal = 0;
      const studentProgress = Array.from(studentModuleProgress.entries()).map(([alumnoId, data]) => {
        let startedClasses = 0;
        let completedClasses = 0;
        let totalOpened = 0;

        const roadmapClasses = Array.from(moduloResourceCounts.keys()).map(modName => {
          const totalInMod = moduloResourceCounts.get(modName) || 0;
          const studentOpenedSet = data.modulos.get(modName);
          const openedCount = studentOpenedSet ? studentOpenedSet.size : 0;
          
          let status = 'Disponible';
          if (openedCount >= totalInMod && totalInMod > 0) {
            status = 'Finalizado';
            completedClasses++;
          } else if (openedCount > 0) {
            status = 'Abierto';
          }
          
          if (openedCount > 0) {
            startedClasses++;
            totalOpened += openedCount;
          }

          // Sumar segundosActivos de los recursos de este alumno y este módulo
          const studentModProgressRows = progressRows.filter(p => p.alumnoMoodleId === alumnoId && (p.modulo || 'Sin clase') === modName);
          const secondsActiveInMod = studentModProgressRows.reduce((acc, p) => acc + (p.segundosActivos || 0), 0);
          
          // Formatear el tiempo de manera amigable
          let tiempoDedicado = '0 seg';
          if (secondsActiveInMod > 0) {
            if (secondsActiveInMod >= 3600) {
              const hs = Math.round((secondsActiveInMod / 3600) * 10) / 10;
              tiempoDedicado = `${hs} hs`;
            } else if (secondsActiveInMod >= 60) {
              const mins = Math.round(secondsActiveInMod / 60);
              tiempoDedicado = `${mins} min`;
            } else {
              tiempoDedicado = `${secondsActiveInMod} seg`;
            }
          }

          // Calcular tiempo estimado de estudio según el formato de los recursos en este módulo
          const modRows = rows.filter(r => (r.modulo || 'Sin clase') === modName);
          let estimatedSeconds = 0;
          modRows.forEach(r => {
            if (r.formato === 'VIDEO') {
              estimatedSeconds += r.videoDuration || (15 * 60); // Usa la duración real o fallback de 15m
            } else if (r.formato === 'TEXTO') {
              // Estimación base por lectura de texto (palabras / 200 words per minute)
              const text = (r.descripcion || '') + ' ' + (r.htmlContent || '');
              const wordCount = text.split(/\s+/).filter(Boolean).length;
              const readTimeMins = Math.max(5, Math.ceil(wordCount / 200));
              estimatedSeconds += readTimeMins * 60;
            } else if (r.formato === 'CUESTIONARIO') {
              estimatedSeconds += 10 * 60;
            } else if (r.formato === 'GENIALLY') {
              estimatedSeconds += 15 * 60;
            } else if (r.formato === 'PDF') {
              estimatedSeconds += 10 * 60;
            } else {
              estimatedSeconds += 5 * 60;
            }
          });

          let tiempoEstimado = '5 min';
          if (estimatedSeconds > 0) {
            if (estimatedSeconds >= 3600) {
              const hs = Math.round((estimatedSeconds / 3600) * 10) / 10;
              tiempoEstimado = `${hs} hs`;
            } else {
              const mins = Math.round(estimatedSeconds / 60);
              tiempoEstimado = `${mins} min`;
            }
          }
          
          return {
            moduloName: modName,
            status,
            openedCount,
            totalCount: totalInMod,
            tiempoDedicado,
            tiempoEstimado
          };
        });

        completedClassesTotal += completedClasses;
        const totalResources = rows.length;
        const progressPercent = totalResources > 0 ? Math.round((totalOpened / totalResources) * 100) : 0;

        return {
          alumnoId,
          alumnoNombre: data.name,
          startedClasses,
          completedClasses,
          progressPercent,
          roadmapClasses,
          activeHours: 0,
          lastActivity: new Date().toISOString()
        };
      });

      // Calcular dedicación de tiempo (StudentTimeStats)
      const statsRepo = AppDataSource.getRepository(StudentTimeStats);
      const timeStats = await statsRepo.find({ where: { courseId } });
      const studentTimeMap = new Map<string, number>();
      timeStats.forEach(t => {
        studentTimeMap.set(t.alumnoMoodleId, (studentTimeMap.get(t.alumnoMoodleId) || 0) + t.segundosActivos);
      });

      // Suma total de horas dedicadas
      let totalActiveSeconds = 0;
      timeStats.forEach(t => { totalActiveSeconds += t.segundosActivos; });
      const totalActiveHours = Math.round((totalActiveSeconds / 3600) * 10) / 10;

      studentProgress.forEach(s => {
        const activeSeconds = studentTimeMap.get(s.alumnoId) || 0;
        s.activeHours = Math.round((activeSeconds / 3600) * 10) / 10;
      });

      // Obtener última actividad por alumno de TrackingEvent
      const lastActivities = await trackingRepo
        .createQueryBuilder('event')
        .select('event.alumnoMoodleId', 'alumno_id')
        .addSelect('MAX(event.timestamp)', 'last_activity')
        .where('event.courseId = :courseId', { courseId })
        .groupBy('event.alumnoMoodleId')
        .getRawMany();
      const lastActivityMap = new Map<string, string>();
      lastActivities.forEach(l => {
        lastActivityMap.set(l.alumno_id, l.last_activity);
      });

      studentProgress.forEach(s => {
        const lastAct = lastActivityMap.get(s.alumnoId);
        if (lastAct) s.lastActivity = lastAct;
      });

      // Resolver nombres reales de alumnos consultando la API de Moodle
      await resolveStudentNames(studentProgress);

      // Ordenar estudiantes por última actividad desc
      studentProgress.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

      // 2. Gráfico Circular de Rango de Progreso
      const progressRanges = {
        '81-100%': 0,
        '61-80%': 0,
        '41-60%': 0,
        '21-40%': 0,
        '0-20%': 0
      };
      studentProgress.forEach(s => {
        const p = s.progressPercent;
        if (p >= 81) progressRanges['81-100%']++;
        else if (p >= 61) progressRanges['61-80%']++;
        else if (p >= 41) progressRanges['41-60%']++;
        else if (p >= 21) progressRanges['21-40%']++;
        else progressRanges['0-20%']++;
      });

      // 3. Embudo de Retención
      const retentionFunnel = await trackingRepo
        .createQueryBuilder('event')
        .select('event.modulo', 'modulo')
        .addSelect("SUM(CASE WHEN event.accion = 'open' THEN 1 ELSE 0 END)", 'open')
        .addSelect("SUM(CASE WHEN event.accion = 'click_continuar' THEN 1 ELSE 0 END)", 'click_continuar')
        .addSelect("SUM(CASE WHEN event.accion = 'finish' THEN 1 ELSE 0 END)", 'finish')
        .where('event.courseId = :courseId', { courseId })
        .groupBy('event.modulo')
        .getRawMany();

      const mappedRetentionFunnel = retentionFunnel.map(f => ({
        modulo: f.modulo,
        open: parseInt(f.open || '0', 10),
        click_continuar: parseInt(f.click_continuar || '0', 10),
        finish: parseInt(f.finish || '0', 10)
      }));

      // 4. Estadísticas de Cuestionarios
      const totalQuizzesCompleted = await trackingRepo.count({
        where: { courseId, accion: 'quiz_submit' }
      });

      const avgScoreRes = await trackingRepo
        .createQueryBuilder('event')
        .select('AVG(event.score)', 'avg')
        .where("event.courseId = :courseId AND event.accion = 'quiz_submit'", { courseId })
        .getRawOne();
      const averageScore = Math.round(parseFloat(avgScoreRes?.avg || '0'));

      const passingCount = await trackingRepo
        .createQueryBuilder('event')
        .where("event.courseId = :courseId AND event.accion = 'quiz_submit' AND event.score >= 70", { courseId })
        .getCount();

      const passingRate = totalQuizzesCompleted > 0
        ? Math.round((passingCount / totalQuizzesCompleted) * 100)
        : 0;

      const quizPerformance = await trackingRepo
        .createQueryBuilder('event')
        .select('event.modulo', 'modulo')
        .addSelect('COUNT(*)', 'attempts')
        .addSelect('AVG(event.score)', 'average_score')
        .addSelect("SUM(CASE WHEN event.score >= 70 THEN 1 ELSE 0 END)", 'passing_attempts')
        .where("event.courseId = :courseId AND event.accion = 'quiz_submit'", { courseId })
        .groupBy('event.modulo')
        .getRawMany();

      const mappedQuizPerformance = quizPerformance.map(q => ({
        modulo: q.modulo,
        attempts: parseInt(q.attempts || '0', 10),
        averageScore: Math.round(parseFloat(q.average_score || '0')),
        passingAttempts: parseInt(q.passing_attempts || '0', 10),
        passingRate: parseInt(q.attempts || '0', 10) > 0 
          ? Math.round((parseInt(q.passing_attempts || '0', 10) / parseInt(q.attempts || '0', 10)) * 100) 
          : 0
      }));

      const studentQuizzes = await trackingRepo.find({
        where: { courseId, accion: 'quiz_submit' },
        order: { timestamp: 'DESC' }
      });

      const mappedStudentQuizzes = studentQuizzes.map(s => ({
        alumnoId: s.alumnoMoodleId,
        alumnoNombre: s.alumnoNombre,
        modulo: s.modulo,
        score: s.score || 0,
        correctAnswers: s.correctAnswers || 0,
        totalQuestions: s.totalQuestions || 0,
        passed: (s.score || 0) >= 70,
        timestamp: s.timestamp
      }));

      res.json({
        kpis: {
          totalAccesses,
          uniqueStudents,
          completedClasses: completedClassesTotal,
          totalActiveHours
        },
        progressRanges,
        commercialUsage: [],
        retentionFunnel: mappedRetentionFunnel,
        studentProgress,
        quizStats: {
          kpis: {
            totalQuizzesCompleted,
            averageScore,
            passingRate
          },
          quizPerformance: mappedQuizPerformance,
          studentQuizzes: mappedStudentQuizzes
        }
      });
      return;
    }

    // --- CÓDIGO GLOBAL POR DEFECTO (SIN FILTRAR POR CURSO) ---
    let qbTotalAccesses = trackingRepo.createQueryBuilder('event');
    if (startDateObj) qbTotalAccesses.andWhere('event.timestamp >= :startDateObj', { startDateObj });
    if (endDateObj) qbTotalAccesses.andWhere('event.timestamp <= :endDateObj', { endDateObj });
    const totalAccesses = await qbTotalAccesses.getCount();
    
    let qbUniqueGlobal = trackingRepo
      .createQueryBuilder('event')
      .select('COUNT(DISTINCT event.alumnoMoodleId)', 'count');
    if (startDateObj) qbUniqueGlobal.andWhere('event.timestamp >= :startDateObj', { startDateObj });
    if (endDateObj) qbUniqueGlobal.andWhere('event.timestamp <= :endDateObj', { endDateObj });
    const uniqueStudentsRes = await qbUniqueGlobal.getRawOne();
    const uniqueStudents = parseInt(uniqueStudentsRes?.count || '0', 10);

    let qbCompletedGlobal = trackingRepo
      .createQueryBuilder('event')
      .where("event.accion = 'finish'");
    if (startDateObj) qbCompletedGlobal.andWhere('event.timestamp >= :startDateObj', { startDateObj });
    if (endDateObj) qbCompletedGlobal.andWhere('event.timestamp <= :endDateObj', { endDateObj });
    const completedClasses = await qbCompletedGlobal.getCount();

    let qbCommercialGlobal = trackingRepo
      .createQueryBuilder('event')
      .select('MAX(event.licencia)', 'licencia')
      .addSelect('MAX(event.materia)', 'materia')
      .addSelect('COUNT(*)', 'total_interactions');
    if (startDateObj) qbCommercialGlobal.andWhere('event.timestamp >= :startDateObj', { startDateObj });
    if (endDateObj) qbCommercialGlobal.andWhere('event.timestamp <= :endDateObj', { endDateObj });
    const commercialUsage = await qbCommercialGlobal
      .groupBy('UPPER(event.licencia)')
      .addGroupBy('UPPER(event.materia)')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    const mappedCommercialUsage = commercialUsage.map(c => ({
      licencia: c.licencia ? c.licencia.toUpperCase() : '',
      materia: c.materia,
      totalInteractions: parseInt(c.total_interactions || '0', 10)
    }));

    let qbRetentionGlobal = trackingRepo
      .createQueryBuilder('event')
      .select('event.modulo', 'modulo')
      .addSelect("SUM(CASE WHEN event.accion = 'open' THEN 1 ELSE 0 END)", 'open')
      .addSelect("SUM(CASE WHEN event.accion = 'click_continuar' THEN 1 ELSE 0 END)", 'click_continuar')
      .addSelect("SUM(CASE WHEN event.accion = 'finish' THEN 1 ELSE 0 END)", 'finish');
    if (startDateObj) qbRetentionGlobal.andWhere('event.timestamp >= :startDateObj', { startDateObj });
    if (endDateObj) qbRetentionGlobal.andWhere('event.timestamp <= :endDateObj', { endDateObj });
    const retentionFunnel = await qbRetentionGlobal
      .groupBy('event.modulo')
      .getRawMany();

    const mappedRetentionFunnel = retentionFunnel.map(f => ({
      modulo: f.modulo,
      open: parseInt(f.open || '0', 10),
      click_continuar: parseInt(f.click_continuar || '0', 10),
      finish: parseInt(f.finish || '0', 10)
    }));

    let qbProgressGlobal = trackingRepo
      .createQueryBuilder('event')
      .select('event.alumnoMoodleId', 'alumno_id')
      .addSelect('MAX(event.alumnoNombre)', 'alumno_nombre')
      .addSelect('MAX(event.licencia)', 'licencia')
      .addSelect('MAX(event.materia)', 'materia')
      .addSelect("COUNT(DISTINCT CASE WHEN event.accion = 'open' THEN event.modulo END)", 'started_classes')
      .addSelect("COUNT(DISTINCT CASE WHEN event.accion = 'finish' THEN event.modulo END)", 'completed_classes')
      .addSelect('MAX(event.timestamp)', 'last_activity');
    if (startDateObj) qbProgressGlobal.andWhere('event.timestamp >= :startDateObj', { startDateObj });
    if (endDateObj) qbProgressGlobal.andWhere('event.timestamp <= :endDateObj', { endDateObj });
    const studentProgressRaw = await qbProgressGlobal
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

    await resolveStudentNames(studentProgress);

    const totalQuizzesCompleted = await trackingRepo.count({
      where: { accion: 'quiz_submit' }
    });

    const avgScoreRes = await trackingRepo
      .createQueryBuilder('event')
      .select('AVG(event.score)', 'avg')
      .where("event.accion = 'quiz_submit'")
      .getRawOne();
    const averageScore = Math.round(parseFloat(avgScoreRes?.avg || '0'));

    const passingCount = await trackingRepo
      .createQueryBuilder('event')
      .where("event.accion = 'quiz_submit' AND event.score >= 70")
      .getCount();

    const passingRate = totalQuizzesCompleted > 0
      ? Math.round((passingCount / totalQuizzesCompleted) * 100)
      : 0;

    const quizPerformance = await trackingRepo
      .createQueryBuilder('event')
      .select('event.modulo', 'modulo')
      .addSelect('COUNT(*)', 'attempts')
      .addSelect('AVG(event.score)', 'average_score')
      .addSelect("SUM(CASE WHEN event.score >= 70 THEN 1 ELSE 0 END)", 'passing_attempts')
      .where("event.accion = 'quiz_submit'")
      .groupBy('event.modulo')
      .getRawMany();

    const mappedQuizPerformance = quizPerformance.map(q => ({
      modulo: q.modulo,
      attempts: parseInt(q.attempts || '0', 10),
      averageScore: Math.round(parseFloat(q.average_score || '0')),
      passingAttempts: parseInt(q.passing_attempts || '0', 10),
      passingRate: parseInt(q.attempts || '0', 10) > 0 
        ? Math.round((parseInt(q.passing_attempts || '0', 10) / parseInt(q.attempts || '0', 10)) * 100) 
        : 0
    }));

    const studentQuizzes = await trackingRepo.find({
      where: { accion: 'quiz_submit' },
      order: { timestamp: 'DESC' }
    });

    const mappedStudentQuizzes = studentQuizzes.map(s => ({
      alumnoId: s.alumnoMoodleId,
      alumnoNombre: s.alumnoNombre,
      modulo: s.modulo,
      score: s.score || 0,
      correctAnswers: s.correctAnswers || 0,
      totalQuestions: s.totalQuestions || 0,
      passed: (s.score || 0) >= 70,
      timestamp: s.timestamp
    }));

    res.json({
      kpis: {
        totalAccesses,
        uniqueStudents,
        completedClasses
      },
      commercialUsage: mappedCommercialUsage,
      retentionFunnel: mappedRetentionFunnel,
      studentProgress,
      quizStats: {
        kpis: {
          totalQuizzesCompleted,
          averageScore,
          passingRate
        },
        quizPerformance: mappedQuizPerformance,
        studentQuizzes: mappedStudentQuizzes
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard reports:', error);
    res.status(500).json({ message: 'Error interno al generar reporte de analítica' });
  }
};

export const createTrackingEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    let { licencia, materia, modulo, accion, alumnoMoodleId, alumnoNombre, score, correctAnswers, totalQuestions, rowId, courseId } = req.body;

    if (!licencia || !accion || !alumnoMoodleId) {
      res.status(400).json({ message: 'Faltan campos requeridos en el evento' });
      return;
    }

    // Si tenemos rowId (y es un UUID válido), resolvemos la materia y el modulo reales desde la base de datos
    const isUuid = typeof rowId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rowId);
    if (rowId && isUuid) {
      try {
        const rowRepo = AppDataSource.getRepository(CourseRow);
        const actualRow = await rowRepo.findOne({ where: { id: rowId } });
        if (actualRow) {
          materia = actualRow.materia || materia;
          modulo = actualRow.modulo || modulo;
        }
      } catch (err) {
        console.error('Error resolving course row for event:', err);
      }
    }

    materia = materia || 'General';
    modulo = modulo || 'Cronograma';

    const trackingRepo = AppDataSource.getRepository(TrackingEvent);
    
    const event = new TrackingEvent();
    event.licencia = licencia;
    event.materia = materia;
    event.modulo = modulo;
    event.accion = accion;
    event.alumnoMoodleId = alumnoMoodleId;
    event.alumnoNombre = alumnoNombre || null;
    if (courseId) event.courseId = courseId;

    if (score !== undefined && score !== null) event.score = parseInt(String(score), 10);
    if (correctAnswers !== undefined && correctAnswers !== null) event.correctAnswers = parseInt(String(correctAnswers), 10);
    if (totalQuestions !== undefined && totalQuestions !== null) event.totalQuestions = parseInt(String(totalQuestions), 10);

    await trackingRepo.save(event);

    // Guardar avance a nivel de recurso persistente (solo si no está bloqueado por prelación)
    if (accion === 'open' && rowId && courseId) {
      try {
        if (alumnoMoodleId && rowId) {
          const progressRepo = AppDataSource.getRepository(StudentResourceProgress);
          let prog = await progressRepo.findOne({
            where: { alumnoMoodleId, courseId, rowId }
          });
          if (!prog) {
            prog = progressRepo.create({
              alumnoMoodleId,
              alumnoNombre: alumnoNombre || undefined,
              courseId,
              rowId,
              materia,
              modulo
            });
            await progressRepo.save(prog);
          }
        }
      } catch (errProgress) {
        console.error('Error al guardar avance en StudentResourceProgress:', errProgress);
      }
    }

    res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('Error saving tracking event:', error);
    res.status(500).json({ message: 'Error interno al guardar evento de analítica' });
  }
};

// POST /api/reports/heartbeat — Registra latido de actividad de un estudiante en Moodle
export const recordHeartbeat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { alumnoMoodleId, courseId, seconds, rowId } = req.body;
    if (!alumnoMoodleId || !courseId) {
      res.status(400).json({ message: 'alumnoMoodleId y courseId son requeridos' });
      return;
    }
    const secToAdd = parseInt(seconds || '60', 10);
    
    // 1. Registrar tiempo general en Moodle por día
    const arDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const todayArStr = arDate.getFullYear() + '-' + String(arDate.getMonth() + 1).padStart(2, '0') + '-' + String(arDate.getDate()).padStart(2, '0');

    const statsRepo = AppDataSource.getRepository(StudentTimeStats);
    
    let record = await statsRepo.findOne({
      where: {
        alumnoMoodleId,
        courseId,
        fecha: todayArStr
      }
    });

    if (record) {
      record.segundosActivos += secToAdd;
      await statsRepo.save(record);
    } else {
      record = statsRepo.create({
        alumnoMoodleId,
        courseId,
        fecha: todayArStr,
        segundosActivos: secToAdd
      });
      await statsRepo.save(record);
    }

    // 2. Si se proporciona rowId, registrar tiempo específico para ese recurso/clase
    if (rowId) {
      try {
        const progressRepo = AppDataSource.getRepository(StudentResourceProgress);
        let progress = await progressRepo.findOne({
          where: { alumnoMoodleId, courseId, rowId }
        });
        if (!progress) {
          const rowRepo = AppDataSource.getRepository(CourseRow);
          const courseRow = await rowRepo.findOne({ where: { id: rowId } });
          progress = progressRepo.create({
            alumnoMoodleId,
            courseId,
            rowId,
            materia: courseRow?.materia || '',
            modulo: courseRow?.modulo || '',
            segundosActivos: secToAdd
          });
        } else {
          progress.segundosActivos += secToAdd;
        }
        await progressRepo.save(progress);
      } catch (errProgress) {
        console.error('Error al registrar segundosActivos en StudentResourceProgress:', errProgress);
      }
    }
      
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error recording heartbeat:', error);
    res.status(500).json({ message: 'Error interno al registrar heartbeat' });
  }
};

// Heuristic to calculate active time in hours
function calculateActiveHours(activities: UserActivity[]): number {
  if (activities.length === 0) return 0;
  
  let totalMs = 0;
  const sessionTimeoutMs = 5 * 60 * 1000; // 5 minutes threshold
  const pingIntervalMs = 60 * 1000; // 1 minute default interval
  
  let lastTime = new Date(activities[0].timestamp).getTime();
  let sessionStart = lastTime;
  
  for (let i = 1; i < activities.length; i++) {
    const currentTime = new Date(activities[i].timestamp).getTime();
    const diff = currentTime - lastTime;
    
    if (diff > sessionTimeoutMs) {
      // End of session, add session duration
      totalMs += Math.max(lastTime - sessionStart, 0) + pingIntervalMs;
      sessionStart = currentTime;
    }
    lastTime = currentTime;
  }
  // Add the last session
  totalMs += Math.max(lastTime - sessionStart, 0) + pingIntervalMs;
  
  return totalMs / (1000 * 60 * 60); // Convert to hours
}

export const logUserActivity = async (
  userId: string,
  action: string,
  panelName?: string,
  courseId?: string,
  details?: string
): Promise<void> => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const activityRepo = AppDataSource.getRepository(UserActivity);
    const activity = new UserActivity();
    activity.userId = user.id;
    activity.userName = user.name;
    activity.email = user.email;
    activity.action = action;
    activity.panelName = panelName || undefined;
    activity.courseId = courseId || undefined;
    activity.details = details || undefined;

    await activityRepo.save(activity);
  } catch (error) {
    console.error('Error logging user activity:', error);
  }
};

export const createUserActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, panelName, courseId, details } = req.body;
    const userId = req.user!.userId;
    await logUserActivity(userId, action, panelName, courseId, details);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error creating user activity:', error);
    res.status(500).json({ message: 'Error al registrar actividad del usuario' });
  }
};

export const getUserActivityReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const activityRepo = AppDataSource.getRepository(UserActivity);
    
    // 1. Recent activities
    const recentActivities = await activityRepo.find({
      order: { timestamp: 'DESC' },
      take: 150
    });
    
    // 2. Aggregate stats per user
    const allActivities = await activityRepo.find({
      order: { timestamp: 'ASC' }
    });
    
    const userGroups: Record<string, UserActivity[]> = {};
    allActivities.forEach(act => {
      const key = act.email;
      if (!userGroups[key]) {
        userGroups[key] = [];
      }
      userGroups[key].push(act);
    });
    
    const userStats = Object.keys(userGroups).map(email => {
      const acts = userGroups[email];
      const name = acts[0].userName;
      const logins = acts.filter(a => a.action === 'login').length;
      const activeHours = calculateActiveHours(acts);
      const lastActivity = acts[acts.length - 1].timestamp;
      
      const panels = acts.map(a => a.panelName).filter(Boolean) as string[];
      const panelCounts: Record<string, number> = {};
      panels.forEach(p => panelCounts[p] = (panelCounts[p] || 0) + 1);
      let mostVisitedPanel = '-';
      let maxCount = 0;
      Object.keys(panelCounts).forEach(p => {
        if (panelCounts[p] > maxCount) {
          maxCount = panelCounts[p];
          mostVisitedPanel = p;
        }
      });

      return {
        email,
        name,
        logins,
        activeHours: parseFloat(activeHours.toFixed(2)),
        lastActivity,
        mostVisitedPanel,
        totalActions: acts.length
      };
    });

    // 3. Activity by Panel
    const panelActivityRaw = await activityRepo
      .createQueryBuilder('activity')
      .select('activity.panelName', 'panel')
      .addSelect('COUNT(*)', 'count')
      .where('activity.panelName IS NOT NULL')
      .groupBy('activity.panelName')
      .getRawMany();

    const panelActivity = panelActivityRaw.map(p => ({
      panel: p.panel,
      count: parseInt(p.count || '0', 10)
    }));

    res.json({
      recentActivities,
      userStats,
      panelActivity
    });
  } catch (error) {
    console.error('Error fetching user activity report:', error);
    res.status(500).json({ message: 'Error interno al generar reporte de actividad de usuarios' });
  }
};

function extractVimeoId(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  
  // 1. Match unlisted format: vimeo.com/1205650818/0c9f5bd3e7
  const unlistedMatch = trimmed.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|manage\/videos\/)?(\d+)\/([a-zA-Z0-9]+)/i);
  if (unlistedMatch) {
    return unlistedMatch[1];
  }
  
  // 2. Standard formats
  const match = trimmed.match(/(?:vimeo\.com|player\.vimeo\.com)\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/|manage\/videos\/)?(\d+)/i);
  return match ? match[1] : '';
}

export const submitExamAttempt = async (req: Request, res: Response): Promise<void> => {
  const { rowId } = req.params;
  const { alumnoId, alumnoNombre, attemptId } = req.body;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  try {
    const attemptRepo = AppDataSource.getRepository(StudentExamAttempt);
    const attempt = await attemptRepo.findOne({ where: { id: attemptId } });

    if (!attempt) {
      res.status(404).send(`
        <html>
        <head><title>Intento no encontrado</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 3rem;">
          <h2>❌ Error: Intento de examen no encontrado</h2>
          <p>No se pudo recuperar el registro del intento actual.</p>
        </body>
        </html>
      `);
      return;
    }

    const rowRepo = AppDataSource.getRepository(CourseRow);
    const row = await rowRepo.findOne({ where: { id: rowId } });

    if (!row) {
      res.status(404).send(`
        <html>
        <head><title>Examen no encontrado</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 3rem;">
          <h2>❌ Error: Clase de examen no encontrada</h2>
        </body>
        </html>
      `);
      return;
    }

    let correctCount = 0;
    const studentAnswers: Record<string, number> = {};

    if (Array.isArray(attempt.questions)) {
      attempt.questions.forEach((q: any, idx: number) => {
        const key = `q_${q.id || idx}`;
        const submittedVal = req.body[key];
        const selectedIndex = submittedVal !== undefined ? parseInt(String(submittedVal), 10) : -1;
        studentAnswers[q.id || String(idx)] = selectedIndex;

        if (selectedIndex === q.correctAnswerIndex) {
          correctCount++;
        }
      });
    }

    const score = Math.round((correctCount / 10) * 100);
    const passed = score >= 70;

    attempt.score = score;
    attempt.passed = passed;
    attempt.answers = studentAnswers;
    await attemptRepo.save(attempt);

    // Si aprobó, registrar progreso
    if (passed) {
      const progressRepo = AppDataSource.getRepository(StudentResourceProgress);
      let prog = await progressRepo.findOne({
        where: { alumnoMoodleId: alumnoId, courseId: attempt.courseId, rowId }
      });
      if (!prog) {
        prog = progressRepo.create({
          alumnoMoodleId: alumnoId,
          alumnoNombre: alumnoNombre || undefined,
          courseId: attempt.courseId,
          rowId,
          materia: row.materia || 'General',
          modulo: row.modulo || 'General',
        });
        await progressRepo.save(prog);
      }
    }

    const previewRepo = AppDataSource.getRepository(CoursePreview);
    const preview = await previewRepo.findOne({ where: { courseId: attempt.courseId } });
    const previewToken = preview?.token || '';
    const courseLink = `/api/preview/cronograma/${previewToken}?alumnoId=${alumnoId}&alumnoNombre=${encodeURIComponent(alumnoNombre)}`;
    const examLink = `/api/preview/clase/${row.id}?alumnoId=${alumnoId}&alumnoNombre=${encodeURIComponent(alumnoNombre)}`;

    // Renderizar página de resultados
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Resultados del Examen</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@400;500;700&display=swap');
          body { font-family: 'Roboto', sans-serif; background-color: #f8fafc; color: #1e293b; padding: 1.5rem; margin: 0; text-align: center; }
          .container { max-width: 600px; margin: 4rem auto; background: #ffffff; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 5px solid ${passed ? '#10b981' : '#ef4444'}; }
          .emoji { font-size: 4rem; }
          h1 { font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; color: ${passed ? '#047857' : '#be123c'}; margin: 1rem 0 0.5rem 0; }
          .score-box { display: inline-block; padding: 10px 24px; font-size: 1.5rem; font-weight: 700; border-radius: 8px; margin: 1rem 0 1.5rem 0; background-color: ${passed ? '#ecfdf5' : '#fff1f2'}; color: ${passed ? '#065f46' : '#9f1239'}; border: 2px solid ${passed ? '#a7f3d0' : '#fecdd3'}; }
          p { font-size: 1.05rem; line-height: 1.5; color: #475569; margin-bottom: 2.5rem; }
          .btn-group { display: flex; justify-content: center; gap: 12px; }
          .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.95rem; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
          .btn-primary { background-color: #0d9488; color: white; box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.25); }
          .btn-secondary { background-color: #64748b; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="emoji">${passed ? '🏆' : '❌'}</div>
          <h1>${passed ? '¡Examen Aprobado!' : 'Examen Desaprobado'}</h1>
          <div class="score-box">Nota: ${score}%</div>
          <p>
            ${passed 
              ? `Felicitaciones. Has respondido correctamente ${correctCount} de 10 preguntas y aprobaste la materia <strong>${row.materia}</strong>.`
              : `Has respondido correctamente ${correctCount} de 10 preguntas. Lamentablemente no alcanzaste la nota mínima de aprobación (70%).`
            }
          </p>
          <div class="btn-group">
            ${passed 
              ? `<a href="${courseLink}" class="btn btn-primary">Ir al Cronograma</a>`
              : `<a href="${examLink}" class="btn btn-primary">Reintentar Examen</a>
                 <a href="${courseLink}" class="btn btn-secondary">Ir al Cronograma</a>`
            }
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Error submitting exam attempt:', err);
    res.status(500).send(`
      <html>
      <body style="font-family: sans-serif; text-align: center; padding: 3rem;">
        <h2>❌ Error interno del servidor</h2>
        <p>${err.message}</p>
      </body>
      </html>
    `);
  }
};

export const getGradebook = async (req: Request, res: Response): Promise<void> => {
  const { courseId, alumnoId } = req.query as { courseId?: string; alumnoId?: string };

  if (!courseId) {
    res.status(400).json({ message: 'Se requiere el parámetro courseId' });
    return;
  }

  try {
    const rowRepo = AppDataSource.getRepository(CourseRow);
    const examRows = await rowRepo.find({
      where: { courseId, formato: 'EXAMEN' },
      order: { sortOrder: 'ASC' }
    });

    const attemptRepo = AppDataSource.getRepository(StudentExamAttempt);

    if (alumnoId) {
      const results = [];
      for (const row of examRows) {
        const attempts = await attemptRepo.find({
          where: { studentMoodleId: alumnoId, courseRowId: row.id },
          order: { attemptNumber: 'ASC' }
        });

        const bestScoreAttempt = attempts.reduce((best, curr) => curr.score > (best?.score || 0) ? curr : best, null as StudentExamAttempt | null);

        results.push({
          rowId: row.id,
          materia: row.materia,
          attemptsCount: attempts.length,
          bestScore: bestScoreAttempt ? bestScoreAttempt.score : null,
          passed: bestScoreAttempt ? bestScoreAttempt.passed : false,
          lastAttemptDate: bestScoreAttempt ? bestScoreAttempt.createdAt : null,
          attempts: attempts.map(a => ({
            attemptNumber: a.attemptNumber,
            score: a.score,
            passed: a.passed,
            createdAt: a.createdAt
          }))
        });
      }

      res.json({
        alumnoId,
        exams: results
      });
    } else {
      const allAttempts = await attemptRepo.find({
        where: { courseId },
        order: { studentMoodleId: 'ASC', attemptNumber: 'ASC' }
      });

      const studentsMap = new Map<string, { studentMoodleId: string; alumnoNombre: string; attempts: StudentExamAttempt[] }>();
      allAttempts.forEach(a => {
        if (!studentsMap.has(a.studentMoodleId)) {
          studentsMap.set(a.studentMoodleId, {
            studentMoodleId: a.studentMoodleId,
            alumnoNombre: a.alumnoNombre || 'Alumno',
            attempts: []
          });
        }
        studentsMap.get(a.studentMoodleId)!.attempts.push(a);
      });

      const consolidated = [];
      for (const [sId, student] of studentsMap.entries()) {
        const studentExams = [];
        for (const row of examRows) {
          const rowAttempts = student.attempts.filter(a => a.courseRowId === row.id);
          const bestScoreAttempt = rowAttempts.reduce((best, curr) => curr.score > (best?.score || 0) ? curr : best, null as StudentExamAttempt | null);

          studentExams.push({
            rowId: row.id,
            materia: row.materia,
            attemptsCount: rowAttempts.length,
            bestScore: bestScoreAttempt ? bestScoreAttempt.score : null,
            passed: bestScoreAttempt ? bestScoreAttempt.passed : false
          });
        }
        consolidated.push({
          studentMoodleId: sId,
          alumnoNombre: student.alumnoNombre,
          exams: studentExams
        });
      }

      res.json({
        courseId,
        exams: examRows.map(r => ({ id: r.id, materia: r.materia })),
        students: consolidated
      });
    }
  } catch (error: any) {
    console.error('Error generating gradebook:', error);
    res.status(500).json({ message: error.message || 'Error al generar el boletín' });
  }
};

export const getMoodleCoursesListHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const moodleCourses = await getMoodleCoursesList();
    const courseRepo = AppDataSource.getRepository(Course);
    const localCourses = await courseRepo.find();
    
    const mappedLocal = localCourses.map(c => ({
      id: c.id,
      name: c.name,
      moodleCourseId: c.moodleCourseId || undefined,
    }));

    res.json({
      moodleCourses,
      localCourses: mappedLocal
    });
  } catch (err: any) {
    console.error('Error in getMoodleCoursesListHandler:', err);
    res.status(500).json({ message: 'Error al obtener la lista de cursos de Moodle' });
  }
};

export const getMoodleStudentProgressHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.query as { courseId?: string };

    if (!courseId) {
      res.status(400).json({ message: 'Se requiere el parámetro courseId' });
      return;
    }

    const courseRepo = AppDataSource.getRepository(Course);
    const rowRepo = AppDataSource.getRepository(CourseRow);
    const progressRepo = AppDataSource.getRepository(StudentResourceProgress);
    const trackingRepo = AppDataSource.getRepository(TrackingEvent);
    const overrideRepo = AppDataSource.getRepository(StudentUnlockOverride);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId);

    // 1. Resolve local Course entity if exists
    let targetCourse: Course | null = null;
    if (isUuid) {
      targetCourse = await courseRepo.findOne({ where: { id: courseId } });
    } else {
      targetCourse = await courseRepo.findOne({
        where: [
          { moodleCourseId: courseId },
          { moodleCourseName: courseId },
          { name: courseId }
        ]
      });

      if (!targetCourse) {
        const allCourses = await courseRepo.find();
        targetCourse = allCourses.find(c =>
          c.moodleCourseId === courseId ||
          c.name.toLowerCase() === courseId.toLowerCase() ||
          (c.moodleCourseName && c.moodleCourseName.toLowerCase() === courseId.toLowerCase()) ||
          c.name.toLowerCase().includes(courseId.toLowerCase())
        ) || null;
      }
    }

    // 2. Resolve course rows safely without invalid Postgres UUID syntax error
    let courseRows: CourseRow[] = [];
    if (targetCourse) {
      courseRows = await rowRepo.find({
        where: { courseId: targetCourse.id },
        order: { sortOrder: 'ASC' }
      });
    } else if (isUuid) {
      courseRows = await rowRepo.find({
        where: { courseId: courseId },
        order: { sortOrder: 'ASC' }
      });
    }

    if (courseRows.length === 0) {
      courseRows = await rowRepo.find({ order: { sortOrder: 'ASC' } });
    }

    // Group rows into distinct classes (modulo)
    const classMap = new Map<string, { modulo: string; materia: string; rows: CourseRow[] }>();
    courseRows.forEach(r => {
      const mod = r.modulo || 'Sin clase';
      if (!classMap.has(mod)) {
        classMap.set(mod, { modulo: mod, materia: r.materia || '', rows: [] });
      }
      classMap.get(mod)!.rows.push(r);
    });

    const totalClasses = classMap.size;

    // 3. Build search course identifiers for progress and tracking
    const searchIdentifiers = Array.from(new Set([
      courseId,
      targetCourse?.id,
      targetCourse?.moodleCourseId,
      targetCourse?.name,
      targetCourse?.moodleCourseName
    ].filter(Boolean) as string[]));

    // Fetch progress and tracking records safely (string varchar columns)
    const progressRecords = await progressRepo.find({
      where: searchIdentifiers.map(cId => ({ courseId: cId }))
    });

    const trackingEvents = await trackingRepo.find({
      where: searchIdentifiers.flatMap(cId => [
        { courseId: cId },
        { licencia: cId }
      ]),
      order: { timestamp: 'DESC' }
    });

    const unlockOverrides = await overrideRepo.find({
      where: searchIdentifiers.map(cId => ({ courseId: cId }))
    });

    // 4. Fetch Moodle WS data (enrolled users and grade items)
    const [moodleEnrolledUsers, moodleStudentGrades] = await Promise.all([
      getMoodleEnrolledUsers(courseId),
      getMoodleStudentGrades(courseId)
    ]);

    // Determine total classes count (prefer Moodle totalItems if available and > 0, else local totalClasses)
    let effectiveTotalClasses = totalClasses;
    if (moodleStudentGrades.length > 0 && moodleStudentGrades[0].totalItems > 0) {
      effectiveTotalClasses = moodleStudentGrades[0].totalItems;
    }

    // Group progress by student ID
    const studentMap = new Map<string, {
      alumnoMoodleId: string;
      alumnoNombre: string;
      modulosCompletados: Set<string>;
      modulosEnCurso: Set<string>;
      moodleCompletedCount?: number;
      moodleTotalCount?: number;
      moodlePercent?: number;
      moodleGradeItems?: Array<{ id: number; itemname: string; completed: boolean }>;
      moodleEnrolDate?: string | null;
      segundosTotales: number;
      lastActivity: string;
      enrolledAt?: string | null;
    }>();

    // Map unlock override creation dates
    const studentUnlockMap = new Map<string, Date>();
    unlockOverrides.forEach(o => {
      if (o.alumnoId && o.unlockedAt) {
        studentUnlockMap.set(o.alumnoId, new Date(o.unlockedAt));
      }
    });

    // Populate with Moodle grade records (contains student names, total items, and completed items!)
    moodleStudentGrades.forEach(g => {
      const sId = String(g.userid);
      studentMap.set(sId, {
        alumnoMoodleId: sId,
        alumnoNombre: g.userfullname || `Alumno ${sId}`,
        modulosCompletados: new Set(),
        modulosEnCurso: new Set(),
        moodleCompletedCount: g.completedItems,
        moodleTotalCount: g.totalItems,
        moodlePercent: g.progressPercent,
        moodleGradeItems: g.gradeItems,
        moodleEnrolDate: g.earliestGradeDate || null,
        segundosTotales: 0,
        lastActivity: new Date().toISOString(),
        enrolledAt: g.earliestGradeDate || null
      });
    });

    // Populate with Moodle enrolled users first
    moodleEnrolledUsers.forEach(u => {
      const sId = String(u.id);
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          alumnoMoodleId: sId,
          alumnoNombre: u.fullname || `Alumno ${sId}`,
          modulosCompletados: new Set(),
          modulosEnCurso: new Set(),
          segundosTotales: 0,
          lastActivity: new Date().toISOString(),
          enrolledAt: u.enrolledAt || null
        });
      } else if (u.enrolledAt && !studentMap.get(sId)!.enrolledAt) {
        studentMap.get(sId)!.enrolledAt = u.enrolledAt;
      }
    });

    // Merge progress records
    progressRecords.forEach(p => {
      const sId = p.alumnoMoodleId;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          alumnoMoodleId: sId,
          alumnoNombre: p.alumnoNombre && p.alumnoNombre !== 'Alumno Moodle' ? p.alumnoNombre : `Alumno ${sId}`,
          modulosCompletados: new Set(),
          modulosEnCurso: new Set(),
          segundosTotales: 0,
          lastActivity: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
          enrolledAt: null
        });
      }

      const sData = studentMap.get(sId)!;
      if (p.alumnoNombre && p.alumnoNombre !== 'Alumno Moodle' && p.alumnoNombre !== 'Alumno de Moodle' && p.alumnoNombre !== 'alumno_anonimo') {
        sData.alumnoNombre = p.alumnoNombre;
      }
      sData.segundosTotales += (p.segundosActivos || 0);

      const mod = p.modulo || 'Sin clase';
      const classInfo = classMap.get(mod);
      const totalInMod = classInfo ? classInfo.rows.length : 1;
      
      const openedInMod = progressRecords.filter(pr => pr.alumnoMoodleId === sId && (pr.modulo || 'Sin clase') === mod);
      if (openedInMod.length >= totalInMod) {
        sData.modulosCompletados.add(mod);
      } else {
        sData.modulosEnCurso.add(mod);
      }
    });

    // Merge tracking events
    trackingEvents.forEach(e => {
      const sId = e.alumnoMoodleId;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          alumnoMoodleId: sId,
          alumnoNombre: e.alumnoNombre || `Alumno ${sId}`,
          modulosCompletados: new Set(),
          modulosEnCurso: new Set(),
          segundosTotales: 0,
          lastActivity: e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
          enrolledAt: null
        });
      } else {
        const sData = studentMap.get(sId)!;
        if (e.alumnoNombre && sData.alumnoNombre.startsWith('Alumno ')) {
          sData.alumnoNombre = e.alumnoNombre;
        }
        if (e.timestamp && new Date(e.timestamp) > new Date(sData.lastActivity)) {
          sData.lastActivity = new Date(e.timestamp).toISOString();
        }
      }
      if (e.accion === 'finish') {
        studentMap.get(sId)!.modulosCompletados.add(e.modulo);
      } else if (e.accion === 'open') {
        if (!studentMap.get(sId)!.modulosCompletados.has(e.modulo)) {
          studentMap.get(sId)!.modulosEnCurso.add(e.modulo);
        }
      }
    });

    // Resolve user profiles & enrolment dates in batch for all students
    const allUserIds = Array.from(studentMap.keys());
    if (allUserIds.length > 0) {
      try {
        const userProfilesMap = await getMoodleUsersByIds(allUserIds);
        for (const [sId, sData] of studentMap.entries()) {
          const profile = userProfilesMap.get(sId);
          if (profile) {
            if (profile.fullname && (sData.alumnoNombre.startsWith('Alumno ') || sData.alumnoNombre === 'Alumno de Moodle')) {
              sData.alumnoNombre = profile.fullname;
            }
          }

          // Prioritize course-specific enrolment/activity dates over general account creation date
          const unlockDate = studentUnlockMap.get(sId);
          const gradeDate = sData.moodleEnrolDate;
          const firstAct = (sData as any).firstActivity;
          const profileDate = profile?.enrolledAt;

          if (unlockDate) {
            sData.enrolledAt = unlockDate.toISOString();
          } else if (gradeDate) {
            sData.enrolledAt = gradeDate;
          } else if (profileDate) {
            sData.enrolledAt = profileDate;
          }
        }
      } catch (eErr) {
        console.warn('[Reports] Error resolving student profiles in batch:', eErr);
      }
    }

    const studentList = Array.from(studentMap.values()).map(s => {
      const localCompletedCount = s.modulosCompletados.size;
      const completedCount = Math.max(localCompletedCount, s.moodleCompletedCount || 0);
      const totalClassesCount = Math.max(effectiveTotalClasses, s.moodleTotalCount || 0);

      let progressPercent = 0;
      if (typeof s.moodlePercent === 'number' && s.moodlePercent > 0) {
        progressPercent = Math.max(s.moodlePercent, totalClassesCount > 0 ? Math.round((completedCount / totalClassesCount) * 100) : 0);
      } else {
        progressPercent = totalClassesCount > 0 ? Math.round((completedCount / totalClassesCount) * 100) : 0;
      }

      let classesBreakdown: any[] = [];
      if (s.moodleGradeItems && s.moodleGradeItems.length > 0) {
        classesBreakdown = s.moodleGradeItems.map(gi => {
          const isCompleted = gi.completed || s.modulosCompletados.has(gi.itemname);
          return {
            modulo: gi.itemname,
            materia: '',
            status: isCompleted ? 'Realizada' : 'Pendiente',
            secondsActive: 0,
            timeSpentFormatted: isCompleted ? 'Completado en Moodle' : '0 seg'
          };
        });
      } else {
        classesBreakdown = Array.from(classMap.entries()).map(([modName, modInfo]) => {
          let status: 'Realizada' | 'En Curso' | 'Pendiente' = 'Pendiente';
          if (s.modulosCompletados.has(modName)) {
            status = 'Realizada';
          } else if (s.modulosEnCurso.has(modName)) {
            status = 'En Curso';
          }

          const studentModProgress = progressRecords.filter(p => p.alumnoMoodleId === s.alumnoMoodleId && (p.modulo || 'Sin clase') === modName);
          const secInMod = studentModProgress.reduce((acc, p) => acc + (p.segundosActivos || 0), 0);

          return {
            modulo: modName,
            materia: modInfo.materia,
            status,
            secondsActive: secInMod,
            timeSpentFormatted: secInMod >= 60 ? `${Math.round(secInMod / 60)} min` : `${secInMod} seg`
          };
        });
      }

      return {
        alumnoId: s.alumnoMoodleId,
        alumnoNombre: s.alumnoNombre,
        completedClassesCount: completedCount,
        totalClassesCount: totalClassesCount,
        progressPercent,
        totalActiveMinutes: Math.round(s.segundosTotales / 60),
        lastActivity: s.lastActivity,
        enrolledAt: s.enrolledAt || null,
        classes: classesBreakdown
      };
    });

    // Sort students by progressPercent desc, then lastActivity desc
    studentList.sort((a, b) => b.progressPercent - a.progressPercent || new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    res.json({
      courseId,
      totalClasses: effectiveTotalClasses,
      studentsCount: studentList.length,
      students: studentList
    });
  } catch (error: any) {
    console.error('Error generating moodle student progress:', error);
    res.status(500).json({ message: error.message || 'Error al obtener el avance de alumnos' });
  }
};

export const getCFStudentProgressHandler = async (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId ? String(req.query.courseId).trim() : '';

    const courseRepo = AppDataSource.getRepository(Course);
    const rowRepo = AppDataSource.getRepository(CourseRow);
    const progressRepo = AppDataSource.getRepository(StudentResourceProgress);
    const trackingRepo = AppDataSource.getRepository(TrackingEvent);
    const overrideRepo = AppDataSource.getRepository(StudentUnlockOverride);

    // 1. Find CourseFactory course
    let targetCourse: Course | null = null;
    if (courseId && courseId !== 'all') {
      targetCourse = await courseRepo.findOne({
        where: { id: courseId },
        relations: ['rows']
      });
      if (!targetCourse) {
        targetCourse = await courseRepo.findOne({
          where: [
            { name: courseId },
            { moodleCourseId: courseId },
            { moodleCourseName: courseId }
          ],
          relations: ['rows']
        });
      }
    }

    if (!targetCourse) {
      const allCourses = await courseRepo.find({ relations: ['rows'], order: { createdAt: 'ASC' } });
      if (allCourses.length > 0) {
        targetCourse = allCourses[0];
      }
    }

    if (!targetCourse) {
      return res.json({
        courseId: courseId || '',
        courseName: 'Sin Cursos',
        totalClasses: 0,
        totalStudents: 0,
        activeStudents: 0,
        averageProgress: 0,
        completedClassesTotal: 0,
        students: []
      });
    }

    // 2. Fetch all CourseRows for this CourseFactory course
    let courseRows: CourseRow[] = targetCourse.rows || [];
    if (!courseRows || courseRows.length === 0) {
      courseRows = await rowRepo.find({
        where: { courseId: targetCourse.id },
        order: { sortOrder: 'ASC' }
      });
    }

    // Group rows into distinct classes (modulo)
    const classMap = new Map<string, { modulo: string; materia: string; rows: CourseRow[] }>();
    courseRows.forEach(r => {
      const mod = r.modulo || 'Sin clase';
      if (!classMap.has(mod)) {
        classMap.set(mod, { modulo: mod, materia: r.materia || '', rows: [] });
      }
      classMap.get(mod)!.rows.push(r);
    });

    const totalClasses = classMap.size;

    // Search identifiers for progress and tracking
    const searchIdentifiers = Array.from(new Set([
      targetCourse.id,
      targetCourse.name,
      targetCourse.moodleCourseId,
      targetCourse.moodleCourseName
    ].filter(Boolean) as string[]));

    // Fetch progress, tracking events, and unlock overrides
    const progressRecords = await progressRepo.find({
      where: searchIdentifiers.map(cId => ({ courseId: cId }))
    });

    const trackingEvents = await trackingRepo.find({
      where: searchIdentifiers.flatMap(cId => [
        { courseId: cId },
        { licencia: cId }
      ]),
      order: { timestamp: 'DESC' }
    });

    const unlockOverrides = await overrideRepo.find({
      where: searchIdentifiers.map(cId => ({ courseId: cId }))
    });

    // Map overrides for redeemed codes
    const studentCodeMap = new Map<string, string>();
    unlockOverrides.forEach(o => {
      if (o.codeRedeemed) {
        studentCodeMap.set(o.alumnoId, o.codeRedeemed);
      }
    });

    // Group progress by student ID
    const studentMap = new Map<string, {
      alumnoMoodleId: string;
      alumnoNombre: string;
      modulosCompletados: Set<string>;
      modulosEnCurso: Set<string>;
      segundosTotales: number;
      lastActivity: string;
      firstActivity: string;
      enrolledAt?: string | null;
      redeemedCode?: string | null;
    }>();

    // Process progress records
    progressRecords.forEach(p => {
      const sId = p.alumnoMoodleId;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          alumnoMoodleId: sId,
          alumnoNombre: p.alumnoNombre && p.alumnoNombre !== 'Alumno Moodle' && p.alumnoNombre !== 'Alumno de Moodle' ? p.alumnoNombre : `Alumno ${sId}`,
          modulosCompletados: new Set(),
          modulosEnCurso: new Set(),
          segundosTotales: 0,
          lastActivity: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
          firstActivity: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          enrolledAt: null,
          redeemedCode: studentCodeMap.get(sId) || null
        });
      }

      const sData = studentMap.get(sId)!;
      if (p.alumnoNombre && p.alumnoNombre !== 'Alumno Moodle' && p.alumnoNombre !== 'Alumno de Moodle' && p.alumnoNombre !== 'alumno_anonimo') {
        sData.alumnoNombre = p.alumnoNombre;
      }
      // progressRecords track time only – NOT completion (visiting a module ≠ finishing it)
      sData.segundosTotales += (p.segundosActivos || 0);
    });

    // Process tracking events — finish events are the CF-internal completion signal
    trackingEvents.forEach(e => {
      const sId = e.alumnoMoodleId;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          alumnoMoodleId: sId,
          alumnoNombre: e.alumnoNombre || `Alumno ${sId}`,
          modulosCompletados: new Set(),
          modulosEnCurso: new Set(),
          segundosTotales: 0,
          lastActivity: e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
          firstActivity: e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
          enrolledAt: null,
          redeemedCode: studentCodeMap.get(sId) || null
        });
      } else {
        const sData = studentMap.get(sId)!;
        if (e.alumnoNombre && sData.alumnoNombre.startsWith('Alumno ')) {
          sData.alumnoNombre = e.alumnoNombre;
        }
        if (e.timestamp) {
          const tDate = new Date(e.timestamp);
          if (tDate > new Date(sData.lastActivity)) {
            sData.lastActivity = tDate.toISOString();
          }
          if (tDate < new Date(sData.firstActivity)) {
            sData.firstActivity = tDate.toISOString();
          }
        }
      }
      if (e.accion === 'finish') {
        studentMap.get(sId)!.modulosCompletados.add(e.modulo);
      } else if (e.accion === 'open') {
        if (!studentMap.get(sId)!.modulosCompletados.has(e.modulo)) {
          studentMap.get(sId)!.modulosEnCurso.add(e.modulo);
        }
      }
    });

    // Merge Moodle grade completion — called per-student with alumnoId because the WS
    // token has grade:view (per-student) but NOT grade:viewall (all students at once).
    // This matches exactly how the iframe preview fetches completion data.
    // Parse potentially multiple comma-separated Moodle course IDs/shortnames
    const rawMoodleIds = (targetCourse.moodleCourseId || targetCourse.id || courseId)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const numericMoodleCourseIds: number[] = [];
    for (const rawId of rawMoodleIds) {
      const resolved = await resolveNumericMoodleCourseId(rawId);
      if (resolved && !numericMoodleCourseIds.includes(resolved)) {
        numericMoodleCourseIds.push(resolved);
      }
    }

    let moodleEnrolMap = new Map<string, string>();

    // Fetch enrolled users from all linked Moodle courses
    for (const numId of numericMoodleCourseIds) {
      try {
        const enrolledUsers = await getMoodleEnrolledUsers(numId);
        enrolledUsers.forEach(u => {
          const sId = String(u.id);
          if (u.enrolledAt) {
            moodleEnrolMap.set(sId, u.enrolledAt);
          }
          if (!studentMap.has(sId)) {
            studentMap.set(sId, {
              alumnoMoodleId: sId,
              alumnoNombre: u.fullname || `Alumno ${sId}`,
              modulosCompletados: new Set(),
              modulosEnCurso: new Set(),
              segundosTotales: 0,
              lastActivity: u.enrolledAt || new Date().toISOString(),
              firstActivity: u.enrolledAt || new Date().toISOString(),
              enrolledAt: u.enrolledAt || null,
              redeemedCode: studentCodeMap.get(sId) || null
            });
          } else {
            const sData = studentMap.get(sId)!;
            if (u.fullname && (sData.alumnoNombre.startsWith('Alumno ') || sData.alumnoNombre === 'Alumno de Moodle')) {
              sData.alumnoNombre = u.fullname;
            }
          }
        });
      } catch (eEnrol) {
        console.warn(`[CF Reports] Could not fetch enrolled users from Moodle course ${numId}:`, eEnrol);
      }
    }

    // Process Moodle grade completion across all linked Moodle courses
    for (const numId of numericMoodleCourseIds) {
      const classGroupList = Array.from(classMap.entries());
      const studentIds = Array.from(studentMap.keys());

      const BATCH_SIZE = 8;
      for (let batchStart = 0; batchStart < studentIds.length; batchStart += BATCH_SIZE) {
        const batch = studentIds.slice(batchStart, batchStart + BATCH_SIZE);
        await Promise.allSettled(batch.map(async (sId) => {
          try {
            const grades = await getMoodleStudentGrades(numId, sId);
            const studentGrade = grades.find((g: any) => String(g.userid) === sId);
            if (!studentGrade || !Array.isArray(studentGrade.gradeItems)) return;

            const sData = studentMap.get(sId)!;
            if (studentGrade.earliestGradeDate && !(sData as any).moodleEnrolDate) {
              (sData as any).moodleEnrolDate = studentGrade.earliestGradeDate;
            }

            const completedItems = studentGrade.gradeItems.filter((gi: any) =>
              gi.completed || gi.graderaw != null || gi.gradedategraded != null
            );

            completedItems.forEach((gi: any) => {
              const giName = (gi.itemname || '').trim();
              if (!giName) return;
              const giLower = giName.toLowerCase();

              if (giLower.startsWith('examen') || giLower.startsWith('evaluacion') || giLower.startsWith('evaluación')) {
                return;
              }

              courseRows.forEach(r => {
                if (r.modulo && isMoodleItemMatchingRow(giName, r)) {
                  sData.modulosCompletados.add(r.modulo);
                }
              });
            });
          } catch {
            // Individual student fetch failed — keep CF-internal completion data
          }
        }));
      }
    }

    // Resolve user profiles & enrolment dates in batch
    const allUserIds = Array.from(studentMap.keys());
    if (allUserIds.length > 0) {
      try {
        const userProfilesMap = await getMoodleUsersByIds(allUserIds);
        for (const [sId, sData] of studentMap.entries()) {
          const profile = userProfilesMap.get(sId);
          if (profile) {
            if (profile.fullname && (sData.alumnoNombre.startsWith('Alumno ') || sData.alumnoNombre === 'Alumno de Moodle')) {
              sData.alumnoNombre = profile.fullname;
            }
          }

          // Hierarchy for enrolledAt:
          // 1. Official enrolment creation date from Moodle API (user_enrolments.timecreated)
          // 2. Manual unlock date in CF override (if Moodle date unavailable)
          // 3. Earliest grade date in Moodle gradebook
          // 4. Moodle user profile registration/access date
          const overrideObj = unlockOverrides.find(o => o.alumnoId === sId);
          const unlockDate = overrideObj?.unlockedAt;
          const moodleEnrolDate = moodleEnrolMap.get(sId);
          const gradeDate = (sData as any).moodleEnrolDate;
          const profileDate = profile?.enrolledAt;

          if (moodleEnrolDate) {
            sData.enrolledAt = moodleEnrolDate;
          } else if (unlockDate) {
            sData.enrolledAt = new Date(unlockDate).toISOString();
          } else if (gradeDate) {
            sData.enrolledAt = gradeDate;
          } else if (profileDate) {
            sData.enrolledAt = profileDate;
          }
        }
      } catch (eErr) {
        console.warn('[CF Reports] Error resolving student profiles in batch:', eErr);
      }
    }

    const studentList = Array.from(studentMap.values()).map(s => {
      const completedCount = s.modulosCompletados.size;
      const totalClassesCount = totalClasses;
      const progressPercent = totalClassesCount > 0 ? Math.round((completedCount / totalClassesCount) * 100) : 0;

      const classesBreakdown = Array.from(classMap.entries()).map(([modName, modInfo]) => {
        let status: 'Realizada' | 'En Curso' | 'Pendiente' = 'Pendiente';
        if (s.modulosCompletados.has(modName)) {
          status = 'Realizada';
        } else if (s.modulosEnCurso.has(modName)) {
          status = 'En Curso';
        }

        const studentModProgress = progressRecords.filter(p => p.alumnoMoodleId === s.alumnoMoodleId && (p.modulo || 'Sin clase') === modName);
        const studentModTracking = trackingEvents.filter(t => t.alumnoMoodleId === s.alumnoMoodleId && (t.modulo || 'Sin clase') === modName);
        const secInMod = studentModProgress.reduce((acc, p) => acc + (p.segundosActivos || 0), 0);

        // Find first access timestamp
        const accessDates: number[] = [
          ...studentModProgress.map(p => p.createdAt ? new Date(p.createdAt).getTime() : null),
          ...studentModTracking.map(t => t.timestamp ? new Date(t.timestamp).getTime() : null)
        ].filter((t): t is number => t !== null && !isNaN(t));

        let firstAccessAt: string | null = null;
        if (accessDates.length > 0) {
          accessDates.sort((a, b) => a - b);
          firstAccessAt = new Date(accessDates[0]).toISOString();
        }

        // Panel 1 release configuration
        const firstRow = modInfo.rows[0];
        const diasDisponibilidad = firstRow?.diasDisponibilidad ?? null;
        const fechaDisponibilidad = firstRow?.fechaDisponibilidad || null;

        // Calculate release date
        let calculatedReleaseDate: string | null = null;
        if (fechaDisponibilidad) {
          calculatedReleaseDate = fechaDisponibilidad;
        } else if (s.enrolledAt && diasDisponibilidad !== null && diasDisponibilidad !== undefined) {
          const enrolMs = new Date(s.enrolledAt).getTime();
          if (!isNaN(enrolMs)) {
            calculatedReleaseDate = new Date(enrolMs + (diasDisponibilidad * 86400000)).toISOString();
          }
        }

        // Determine availability status
        let availabilityStatus: 'Realizada' | 'En Curso' | 'Disponible' | 'Bloqueada' = 'Bloqueada';
        if (status === 'Realizada') {
          availabilityStatus = 'Realizada';
        } else if (status === 'En Curso' || firstAccessAt !== null) {
          availabilityStatus = 'En Curso';
        } else if (calculatedReleaseDate) {
          const relMs = new Date(calculatedReleaseDate).getTime();
          if (!isNaN(relMs) && relMs <= Date.now()) {
            availabilityStatus = 'Disponible';
          } else {
            availabilityStatus = 'Bloqueada';
          }
        } else {
          availabilityStatus = 'Disponible';
        }

        return {
          modulo: modName,
          materia: modInfo.materia,
          status,
          availabilityStatus,
          diasDisponibilidad,
          fechaDisponibilidad,
          calculatedReleaseDate,
          firstAccessAt,
          secondsActive: secInMod,
          timeSpentFormatted: secInMod >= 60 ? `${Math.round(secInMod / 60)} min` : `${secInMod} seg`,
          redeemedCode: s.redeemedCode || null
        };
      });

      return {
        alumnoId: s.alumnoMoodleId,
        alumnoNombre: s.alumnoNombre,
        completedClassesCount: completedCount,
        totalClassesCount: totalClassesCount,
        progressPercent,
        totalActiveMinutes: Math.round(s.segundosTotales / 60),
        lastActivity: s.lastActivity,
        enrolledAt: s.enrolledAt || null,
        redeemedCode: s.redeemedCode || null,
        classes: classesBreakdown
      };
    });

    studentList.sort((a, b) => b.progressPercent - a.progressPercent || new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    const totalStudents = studentList.length;
    const activeStudents = studentList.filter(s => s.totalActiveMinutes > 0 || s.completedClassesCount > 0).length;
    const avgProgress = totalStudents > 0 ? Math.round(studentList.reduce((acc, s) => acc + s.progressPercent, 0) / totalStudents) : 0;
    const completedClassesTotal = studentList.reduce((acc, s) => acc + s.completedClassesCount, 0);

    res.json({
      courseId: targetCourse.id,
      courseName: targetCourse.name,
      totalClasses,
      totalStudents,
      activeStudents,
      averageProgress: avgProgress,
      completedClassesTotal,
      students: studentList
    });
  } catch (error: any) {
    console.error('[CF Reports] Error in getCFStudentProgressHandler:', error);
    res.status(500).json({ message: error.message || 'Error al obtener el avance de CourseFactory' });
  }
};

export const getCFStudent360ProgressHandler = async (req: Request, res: Response) => {
  try {
    const searchFilter = req.query.search ? String(req.query.search).trim().toLowerCase() : '';

    const courseRepo = AppDataSource.getRepository(Course);
    const rowRepo = AppDataSource.getRepository(CourseRow);
    const progressRepo = AppDataSource.getRepository(StudentResourceProgress);
    const trackingRepo = AppDataSource.getRepository(TrackingEvent);
    const overrideRepo = AppDataSource.getRepository(StudentUnlockOverride);

    // 1. Fetch all CourseFactory courses with rows
    const allCourses = await courseRepo.find({
      relations: ['rows'],
      order: { createdAt: 'ASC' }
    });

    if (allCourses.length === 0) {
      return res.json({ students: [] });
    }

    // Ensure rows loaded for all courses
    for (const c of allCourses) {
      if (!c.rows || c.rows.length === 0) {
        c.rows = await rowRepo.find({ where: { courseId: c.id }, order: { sortOrder: 'ASC' } });
      }
    }

    // 2. Fetch all progress, tracking, and unlock overrides
    const progressRecords = await progressRepo.find();
    const trackingEvents = await trackingRepo.find({ order: { timestamp: 'DESC' } });
    const unlockOverrides = await overrideRepo.find();

    // Map unlock overrides by student + course
    const studentCodeMap = new Map<string, string>(); // sId -> code
    unlockOverrides.forEach(o => {
      if (o.codeRedeemed) {
        studentCodeMap.set(`${o.alumnoId}_${o.courseId}`, o.codeRedeemed);
      }
    });

    // 3. Resolve all Moodle enrolled users for courses with moodleCourseId
    const moodleEnrolMapByCourse = new Map<string, Map<string, string>>(); // courseId -> Map<sId, enrolledAt>
    for (const c of allCourses) {
      if (c.moodleCourseId) {
        const rawMoodleIds = c.moodleCourseId.split(',').map(s => s.trim()).filter(Boolean);
        const courseEnrolMap = new Map<string, string>();

        for (const rawId of rawMoodleIds) {
          try {
            const numId = await resolveNumericMoodleCourseId(rawId);
            if (numId) {
              const enrolled = await getMoodleEnrolledUsers(numId);
              enrolled.forEach(u => {
                if (u.enrolledAt) {
                  courseEnrolMap.set(String(u.id), u.enrolledAt);
                }
              });
            }
          } catch (e) {
            console.warn(`[360 Report] Error resolving Moodle course ${rawId}:`, e);
          }
        }
        moodleEnrolMapByCourse.set(c.id, courseEnrolMap);
      }
    }

    // 4. Collect all unique student IDs
    const studentIdsSet = new Set<string>();
    progressRecords.forEach(p => p.alumnoMoodleId && studentIdsSet.add(p.alumnoMoodleId));
    trackingEvents.forEach(t => t.alumnoMoodleId && studentIdsSet.add(t.alumnoMoodleId));
    unlockOverrides.forEach(o => o.alumnoId && studentIdsSet.add(o.alumnoId));
    moodleEnrolMapByCourse.forEach((map) => {
      map.forEach((_, sId) => studentIdsSet.add(sId));
    });

    const allStudentIds = Array.from(studentIdsSet);
    if (allStudentIds.length === 0) {
      return res.json({ students: [] });
    }

    // Resolve Moodle user profiles (names & emails)
    const userProfilesMap = await getMoodleUsersByIds(allStudentIds);

    // 5. Build 360 profile per student
    const student360List = allStudentIds.map(sId => {
      const profile = userProfilesMap.get(sId);
      
      // Find name from tracking/progress fallback
      let studentName = profile?.fullname || '';
      if (!studentName || studentName === 'Alumno Moodle' || studentName === 'Alumno de Moodle') {
        const pMatch = progressRecords.find(p => p.alumnoMoodleId === sId && p.alumnoNombre && p.alumnoNombre !== 'Alumno Moodle');
        const tMatch = trackingEvents.find(t => t.alumnoMoodleId === sId && t.alumnoNombre && t.alumnoNombre !== 'Alumno Moodle');
        studentName = pMatch?.alumnoNombre || tMatch?.alumnoNombre || `Alumno ${sId}`;
      }

      const email = profile?.email || null;

      // Build course breakdown for this student
      let totalActiveSecondsGlobal = 0;
      let globalLastActivityMs = 0;

      const studentCourses = allCourses.map(c => {
        const cId = c.id;
        const searchIdentifiers = Array.from(new Set([c.id, c.name, c.moodleCourseId, c.moodleCourseName].filter(Boolean) as string[]));

        // Rows and class map for this course
        const rows = c.rows || [];
        const classMap = new Map<string, { modulo: string; materia: string; rows: CourseRow[] }>();
        rows.forEach(r => {
          const mod = r.modulo || 'Sin clase';
          if (!classMap.has(mod)) {
            classMap.set(mod, { modulo: mod, materia: r.materia || '', rows: [] });
          }
          classMap.get(mod)!.rows.push(r);
        });

        const totalClasses = classMap.size;
        if (totalClasses === 0) return null;

        // Student's progress and tracking for this course
        const studentProgress = progressRecords.filter(p => p.alumnoMoodleId === sId && searchIdentifiers.includes(p.courseId));
        const studentTracking = trackingEvents.filter(t => t.alumnoMoodleId === sId && ((t.courseId && searchIdentifiers.includes(t.courseId)) || searchIdentifiers.includes(t.licencia)));

        const isEnrolledInMoodle = moodleEnrolMapByCourse.get(c.id)?.has(sId);
        const hasActivity = studentProgress.length > 0 || studentTracking.length > 0 || isEnrolledInMoodle;
        if (!hasActivity) return null;

        // Modulos completados/en curso
        const modulosCompletados = new Set<string>();
        const modulosEnCurso = new Set<string>();
        let courseActiveSeconds = 0;
        let courseLastActivityMs = 0;
        let courseFirstActivityMs = Number.MAX_SAFE_INTEGER;

        studentProgress.forEach(p => {
          courseActiveSeconds += (p.segundosActivos || 0);
          if (p.updatedAt) {
            const ms = new Date(p.updatedAt).getTime();
            if (ms > courseLastActivityMs) courseLastActivityMs = ms;
          }
          if (p.createdAt) {
            const ms = new Date(p.createdAt).getTime();
            if (ms < courseFirstActivityMs) courseFirstActivityMs = ms;
          }
        });

        studentTracking.forEach(t => {
          if (t.timestamp) {
            const ms = new Date(t.timestamp).getTime();
            if (ms > courseLastActivityMs) courseLastActivityMs = ms;
            if (ms < courseFirstActivityMs) courseFirstActivityMs = ms;
          }
          if (t.accion === 'finish') {
            modulosCompletados.add(t.modulo);
          } else if (t.accion === 'open') {
            if (!modulosCompletados.has(t.modulo)) {
              modulosEnCurso.add(t.modulo);
            }
          }
        });

        totalActiveSecondsGlobal += courseActiveSeconds;
        if (courseLastActivityMs > globalLastActivityMs) {
          globalLastActivityMs = courseLastActivityMs;
        }

        // Determine course-specific enrolledAt date
        const overrideObj = unlockOverrides.find(o => o.alumnoId === sId && searchIdentifiers.includes(o.courseId));
        const unlockDate = overrideObj?.unlockedAt;
        const moodleEnrolDate = moodleEnrolMapByCourse.get(c.id)?.get(sId);
        const profileDate = profile?.enrolledAt;

        let courseEnrolledAt: string | null = null;
        if (moodleEnrolDate) {
          courseEnrolledAt = moodleEnrolDate;
        } else if (unlockDate) {
          courseEnrolledAt = new Date(unlockDate).toISOString();
        } else if (courseFirstActivityMs !== Number.MAX_SAFE_INTEGER) {
          courseEnrolledAt = new Date(courseFirstActivityMs).toISOString();
        } else if (profileDate) {
          courseEnrolledAt = profileDate;
        }

        const redeemedCode = studentCodeMap.get(`${sId}_${c.id}`) || null;

        // Build class breakdown
        const classesBreakdown = Array.from(classMap.entries()).map(([modName, modInfo]) => {
          let status: 'Realizada' | 'En Curso' | 'Pendiente' = 'Pendiente';
          if (modulosCompletados.has(modName)) {
            status = 'Realizada';
          } else if (modulosEnCurso.has(modName)) {
            status = 'En Curso';
          }

          const modProgress = studentProgress.filter(p => (p.modulo || 'Sin clase') === modName);
          const modTracking = studentTracking.filter(t => (t.modulo || 'Sin clase') === modName);
          const secInMod = modProgress.reduce((acc, p) => acc + (p.segundosActivos || 0), 0);

          const accessDates: number[] = [
            ...modProgress.map(p => p.createdAt ? new Date(p.createdAt).getTime() : null),
            ...modTracking.map(t => t.timestamp ? new Date(t.timestamp).getTime() : null)
          ].filter((t): t is number => t !== null && !isNaN(t));

          let firstAccessAt: string | null = null;
          if (accessDates.length > 0) {
            accessDates.sort((a, b) => a - b);
            firstAccessAt = new Date(accessDates[0]).toISOString();
          }

          const firstRow = modInfo.rows[0];
          const diasDisponibilidad = firstRow?.diasDisponibilidad ?? null;
          const fechaDisponibilidad = firstRow?.fechaDisponibilidad || null;

          let calculatedReleaseDate: string | null = null;
          if (fechaDisponibilidad) {
            calculatedReleaseDate = fechaDisponibilidad;
          } else if (courseEnrolledAt && diasDisponibilidad !== null && diasDisponibilidad !== undefined) {
            const enrolMs = new Date(courseEnrolledAt).getTime();
            if (!isNaN(enrolMs)) {
              calculatedReleaseDate = new Date(enrolMs + (diasDisponibilidad * 86400000)).toISOString();
            }
          }

          let availabilityStatus: 'Realizada' | 'En Curso' | 'Disponible' | 'Bloqueada' = 'Bloqueada';
          if (status === 'Realizada') {
            availabilityStatus = 'Realizada';
          } else if (status === 'En Curso') {
            availabilityStatus = 'En Curso';
          } else if (calculatedReleaseDate) {
            const relMs = new Date(calculatedReleaseDate).getTime();
            if (!isNaN(relMs) && relMs <= Date.now()) {
              availabilityStatus = 'Disponible';
            } else {
              availabilityStatus = 'Bloqueada';
            }
          } else {
            availabilityStatus = 'Disponible';
          }

          return {
            modulo: modName,
            materia: modInfo.materia,
            status,
            availabilityStatus,
            diasDisponibilidad,
            fechaDisponibilidad,
            calculatedReleaseDate,
            firstAccessAt,
            secondsActive: secInMod,
            timeSpentFormatted: secInMod >= 60 ? `${Math.round(secInMod / 60)} min` : `${secInMod} seg`,
            redeemedCode
          };
        });

        const completedCount = modulosCompletados.size;
        const progressPercent = totalClasses > 0 ? Math.round((completedCount / totalClasses) * 100) : 0;

        return {
          courseId: c.id,
          courseName: c.name,
          moodleCourseId: c.moodleCourseId || null,
          completedClassesCount: completedCount,
          totalClassesCount: totalClasses,
          progressPercent,
          enrolledAt: courseEnrolledAt,
          redeemedCode,
          classes: classesBreakdown
        };
      }).filter((c): c is NonNullable<typeof c> => c !== null);

      if (studentCourses.length === 0) return null;

      const lastActivity = globalLastActivityMs > 0 ? new Date(globalLastActivityMs).toISOString() : new Date().toISOString();

      return {
        alumnoId: sId,
        alumnoNombre: studentName,
        email,
        totalCourses: studentCourses.length,
        totalActiveMinutes: Math.round(totalActiveSecondsGlobal / 60),
        lastActivity,
        courses: studentCourses
      };
    }).filter((s): s is NonNullable<typeof s> => s !== null);

    // Apply search filter if provided
    let filteredStudents = student360List;
    if (searchFilter) {
      filteredStudents = student360List.filter(s =>
        s.alumnoNombre.toLowerCase().includes(searchFilter) ||
        s.alumnoId.toLowerCase().includes(searchFilter) ||
        (s.email && s.email.toLowerCase().includes(searchFilter))
      );
    }

    filteredStudents.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    res.json({
      totalStudents: filteredStudents.length,
      students: filteredStudents
    });
  } catch (error: any) {
    console.error('[CF Reports] Error in getCFStudent360ProgressHandler:', error);
    res.status(500).json({ message: error.message || 'Error al obtener el reporte 360 de alumnos' });
  }
};


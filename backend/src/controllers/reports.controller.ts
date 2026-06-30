import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { TrackingEvent } from '../entities/TrackingEvent';
import { User } from '../entities/User';
import { UserActivity } from '../entities/UserActivity';
import { StudentResourceProgress } from '../entities/StudentResourceProgress';
import { StudentTimeStats } from '../entities/StudentTimeStats';
import { CourseRow } from '../entities/CourseRow';


export const getDashboardReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.query as { courseId?: string };
    const trackingRepo = AppDataSource.getRepository(TrackingEvent);

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
          
          return {
            moduloName: modName,
            status,
            openedCount,
            totalCount: totalInMod
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
    const totalAccesses = await trackingRepo.count();
    
    const uniqueStudentsRes = await trackingRepo
      .createQueryBuilder('event')
      .select('COUNT(DISTINCT event.alumnoMoodleId)', 'count')
      .getRawOne();
    const uniqueStudents = parseInt(uniqueStudentsRes?.count || '0', 10);

    const completedClasses = await trackingRepo.count({
      where: { accion: 'finish' }
    });

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

    // Si tenemos rowId, resolvemos la materia y el modulo reales desde la base de datos
    if (rowId) {
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

    // Guardar avance a nivel de recurso persistente
    if (accion === 'open' && rowId && courseId) {
      try {
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
    const { alumnoMoodleId, courseId, seconds } = req.body;
    if (!alumnoMoodleId || !courseId) {
      res.status(400).json({ message: 'alumnoMoodleId y courseId son requeridos' });
      return;
    }
    const secToAdd = parseInt(seconds || '60', 10);
    
    // Obtener la fecha en la zona horaria de Argentina (America/Argentina/Buenos_Aires)
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

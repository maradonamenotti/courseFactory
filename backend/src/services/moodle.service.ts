export const createMoodleCourse = async (name: string, shortname?: string, categoryId: number = 1): Promise<{ id: number, shortname: string }> => {
  const url = process.env.MOODLE_URL;
  const token = process.env.MOODLE_TOKEN;

  if (!url || !token) {
    throw new Error('Configuración de Moodle no encontrada en el backend');
  }

  const baseUrl = url.endsWith('/') ? url : `${url}/`;
  const endpoint = `${baseUrl}webservice/rest/server.php`;

  const params = new URLSearchParams();
  params.append('wstoken', token);
  params.append('wsfunction', 'core_course_create_courses');
  params.append('moodlewsrestformat', 'json');
  
  params.append('courses[0][fullname]', name);
  params.append('courses[0][shortname]', shortname || name);
  params.append('courses[0][categoryid]', categoryId.toString());

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: params,
    });
    
    const data: any = await response.json();
    
    if (data.exception) {
      throw new Error(`Moodle API Error: ${data.message}`);
    }

    if (Array.isArray(data) && data.length > 0) {
      return {
        id: data[0].id,
        shortname: data[0].shortname,
      };
    }
    
    throw new Error('Respuesta inesperada de Moodle');
  } catch (error: any) {
    console.error('Error al crear curso en Moodle:', error);
    throw new Error(error.message || 'Error de comunicación con Moodle');
  }
};
export const getMoodleCoursesList = async (): Promise<Array<{ id: number; fullname: string; shortname: string }>> => {
  const url = process.env.MOODLE_URL;
  const token = process.env.MOODLE_TOKEN;

  if (!url || !token) {
    return [];
  }

  const baseUrl = url.endsWith('/') ? url : `${url}/`;
  const endpoint = `${baseUrl}webservice/rest/server.php`;

  const params = new URLSearchParams();
  params.append('wstoken', token);
  params.append('wsfunction', 'core_course_get_courses');
  params.append('moodlewsrestformat', 'json');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: params,
    });
    const data: any = await response.json();
    if (Array.isArray(data)) {
      return data
        .filter((c: any) => c.id > 1)
        .map((c: any) => ({
          id: c.id,
          fullname: c.fullname,
          shortname: c.shortname
        }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching Moodle courses list:', error);
    return [];
  }
};

export const checkMoodleUserRole = async (shortname: string, alumnoId: string): Promise<string[]> => {
  const url = process.env.MOODLE_URL;
  const token = process.env.MOODLE_TOKEN;

  if (!url || !token || !shortname || !alumnoId) {
    return [];
  }

  const baseUrl = url.endsWith('/') ? url : `${url}/`;
  const endpoint = `${baseUrl}webservice/rest/server.php`;

  try {
    // 1. Obtener el ID del curso de Moodle por su shortname
    const courseParams = new URLSearchParams();
    courseParams.append('wstoken', token);
    courseParams.append('wsfunction', 'core_course_get_courses_by_field');
    courseParams.append('moodlewsrestformat', 'json');
    courseParams.append('field', 'shortname');
    courseParams.append('value', shortname);

    const courseRes = await fetch(endpoint, { method: 'POST', body: courseParams });
    const courseData: any = await courseRes.json();

    if (courseData.exception || !courseData.courses || courseData.courses.length === 0) {
      console.warn(`[Moodle Role Check] No se pudo encontrar el curso con shortname: ${shortname}`);
      return [];
    }

    const moodleCourseId = courseData.courses[0].id;

    // 2. Obtener el perfil del usuario en ese curso
    const userParams = new URLSearchParams();
    userParams.append('wstoken', token);
    userParams.append('wsfunction', 'core_user_get_course_user_profiles');
    userParams.append('moodlewsrestformat', 'json');
    userParams.append('userlist[0][userid]', alumnoId);
    userParams.append('userlist[0][courseid]', moodleCourseId.toString());

    const userRes = await fetch(endpoint, { method: 'POST', body: userParams });
    const userData: any = await userRes.json();

    if (userData.exception || !Array.isArray(userData) || userData.length === 0) {
      console.warn(`[Moodle Role Check] No se pudo obtener el perfil para alumnoId: ${alumnoId}`);
      return [];
    }

    const roles = userData[0].roles || [];
    const roleShortnames = roles.map((r: any) => (r.shortname || '').toLowerCase().trim());
    console.log(`[Moodle Role Check] Roles de usuario ${alumnoId} en curso ${shortname}:`, roleShortnames);
    return roleShortnames;
  } catch (err) {
    console.error('[Moodle Role Check] Error al verificar roles en Moodle:', err);
    return [];
  }
};

export const getMoodleEnrolledUsers = async (courseId: number | string): Promise<Array<{ id: number; fullname: string; email?: string }>> => {
  const url = process.env.MOODLE_URL;
  const token = process.env.MOODLE_TOKEN;

  if (!url || !token || !courseId) {
    return [];
  }

  const baseUrl = url.endsWith('/') ? url : `${url}/`;
  const endpoint = `${baseUrl}webservice/rest/server.php`;

  try {
    let numericCourseId = Number(courseId);

    if (isNaN(numericCourseId)) {
      const courseParams = new URLSearchParams();
      courseParams.append('wstoken', token);
      courseParams.append('wsfunction', 'core_course_get_courses_by_field');
      courseParams.append('moodlewsrestformat', 'json');
      courseParams.append('field', 'shortname');
      courseParams.append('value', String(courseId));

      const courseRes = await fetch(endpoint, { method: 'POST', body: courseParams });
      const courseData: any = await courseRes.json();
      if (courseData.courses && courseData.courses.length > 0) {
        numericCourseId = courseData.courses[0].id;
      } else {
        return [];
      }
    }

    const params = new URLSearchParams();
    params.append('wstoken', token);
    params.append('wsfunction', 'core_enrol_get_enrolled_users');
    params.append('moodlewsrestformat', 'json');
    params.append('courseid', numericCourseId.toString());

    const response = await fetch(endpoint, { method: 'POST', body: params });
    const data: any = await response.json();

    if (Array.isArray(data)) {
      return data.map((u: any) => ({
        id: u.id,
        fullname: u.fullname || `${u.firstname || ''} ${u.lastname || ''}`.trim() || `Alumno ${u.id}`,
        email: u.email
      }));
    }
    return [];
  } catch (error) {
    console.error(`[Moodle WS] Error fetching enrolled users for course ${courseId}:`, error);
    return [];
  }
};

export const getMoodleUsersByIds = async (ids: Array<number | string>): Promise<Map<string, { fullname: string; email?: string }>> => {
  const url = process.env.MOODLE_URL;
  const token = process.env.MOODLE_TOKEN;
  const result = new Map<string, { fullname: string; email?: string }>();

  if (!url || !token || !ids || ids.length === 0) {
    return result;
  }

  const cleanIds: number[] = [];
  const rawToNumericMap = new Map<string, number>();

  ids.forEach(rawId => {
    const str = String(rawId).trim();
    let num: number | null = null;
    if (/^\d+$/.test(str)) {
      num = parseInt(str, 10);
    } else if (/^moodle_user_\d+$/i.test(str)) {
      num = parseInt(str.replace(/^moodle_user_/i, ''), 10);
    }
    if (num !== null && !isNaN(num) && num > 0) {
      cleanIds.push(num);
      rawToNumericMap.set(str, num);
    }
  });

  const uniqueCleanIds = Array.from(new Set(cleanIds));
  if (uniqueCleanIds.length === 0) return result;

  const baseUrl = url.endsWith('/') ? url : `${url}/`;
  const endpoint = `${baseUrl}webservice/rest/server.php`;

  const fetchSingleUser = async (idNum: number): Promise<{ id: number; fullname: string; email?: string } | null> => {
    try {
      const params = new URLSearchParams();
      params.append('wstoken', token);
      params.append('wsfunction', 'core_user_get_users_by_field');
      params.append('moodlewsrestformat', 'json');
      params.append('field', 'id');
      params.append('values[0]', idNum.toString());

      const response = await fetch(endpoint, { method: 'POST', body: params });
      const data: any = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const u = data[0];
        const fullname = u.fullname || `${u.firstname || ''} ${u.lastname || ''}`.trim();
        if (fullname) {
          return { id: idNum, fullname, email: u.email };
        }
      }
    } catch (e) {
      // Ignorar error si el usuario no existe en Moodle
    }
    return null;
  };

  const userResults = await Promise.all(uniqueCleanIds.map(fetchSingleUser));
  const userMapByNumeric = new Map<number, { fullname: string; email?: string }>();
  userResults.forEach(u => {
    if (u) userMapByNumeric.set(u.id, { fullname: u.fullname, email: u.email });
  });

  ids.forEach(rawId => {
    const str = String(rawId).trim();
    const num = rawToNumericMap.get(str);
    if (num && userMapByNumeric.has(num)) {
      result.set(str, userMapByNumeric.get(num)!);
    }
  });

  return result;
};

export interface MoodleStudentGradeRecord {
  userid: number;
  userfullname: string;
  totalItems: number;
  completedItems: number;
  progressPercent: number;
  gradeItems: Array<{
    id: number;
    itemname: string;
    itemmodule?: string;
    completed: boolean;
    gradeFormatted?: string;
  }>;
}

export const getMoodleStudentGrades = async (courseId: number | string, alumnoId?: number | string): Promise<MoodleStudentGradeRecord[]> => {
  const url = process.env.MOODLE_URL;
  const token = process.env.MOODLE_TOKEN;

  if (!url || !token || !courseId) {
    return [];
  }

  const baseUrl = url.endsWith('/') ? url : `${url}/`;
  const endpoint = `${baseUrl}webservice/rest/server.php`;

  try {
    let numericCourseId = Number(courseId);

    if (isNaN(numericCourseId)) {
      const courseParams = new URLSearchParams();
      courseParams.append('wstoken', token);
      courseParams.append('wsfunction', 'core_course_get_courses_by_field');
      courseParams.append('moodlewsrestformat', 'json');
      courseParams.append('field', 'shortname');
      courseParams.append('value', String(courseId));

      const courseRes = await fetch(endpoint, { method: 'POST', body: courseParams });
      const courseData: any = await courseRes.json();
      if (courseData.courses && courseData.courses.length > 0) {
        numericCourseId = courseData.courses[0].id;
      } else {
        return [];
      }
    }

    const params = new URLSearchParams();
    params.append('wstoken', token);
    params.append('wsfunction', 'gradereport_user_get_grade_items');
    params.append('moodlewsrestformat', 'json');
    params.append('courseid', numericCourseId.toString());
    if (alumnoId) {
      params.append('userid', String(alumnoId));
    }

    const response = await fetch(endpoint, { method: 'POST', body: params });
    const data: any = await response.json();

    if (data && Array.isArray(data.usergrades)) {
      return data.usergrades.map((ug: any) => {
        const modItems = (ug.gradeitems || []).filter((gi: any) => gi.itemtype === 'mod');
        const completedItems = modItems.filter((gi: any) =>
          gi.graderaw !== null ||
          gi.gradedategraded !== null ||
          (gi.gradeformatted && gi.gradeformatted !== '-' && gi.gradeformatted !== '0.00')
        );

        const totalCount = modItems.length;
        const compCount = completedItems.length;
        const percent = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;

        return {
          userid: ug.userid,
          userfullname: ug.userfullname,
          totalItems: totalCount,
          completedItems: compCount,
          progressPercent: percent,
          gradeItems: modItems.map((gi: any) => {
            const isCompleted = gi.graderaw !== null || gi.gradedategraded !== null || (gi.gradeformatted && gi.gradeformatted !== '-' && gi.gradeformatted !== '0.00');
            return {
              id: gi.id,
              itemname: gi.itemname || 'Lección Moodle',
              itemmodule: gi.itemmodule,
              completed: isCompleted,
              gradeFormatted: gi.gradeformatted
            };
          })
        };
      });
    }

    return [];
  } catch (error) {
    console.error(`[Moodle WS] Error fetching grade items for course ${courseId}:`, error);
    return [];
  }
};

export const markMoodleActivityCompleted = async (cmid: number | string, completed: boolean = true): Promise<boolean> => {
  const url = process.env.MOODLE_URL;
  const token = process.env.MOODLE_TOKEN;

  if (!url || !token || !cmid) {
    return false;
  }

  const baseUrl = url.endsWith('/') ? url : `${url}/`;
  const endpoint = `${baseUrl}webservice/rest/server.php`;

  try {
    const params = new URLSearchParams();
    params.append('wstoken', token);
    params.append('wsfunction', 'core_completion_update_activity_completion_status_manually');
    params.append('moodlewsrestformat', 'json');
    params.append('cmid', cmid.toString());
    params.append('completed', completed ? '1' : '0');

    const response = await fetch(endpoint, { method: 'POST', body: params });
    const data: any = await response.json();

    if (data.status) {
      console.log(`[Moodle WS] Activity ${cmid} marked completed status:`, data.status);
      return true;
    }
    if (data.exception) {
      console.warn(`[Moodle WS] Cannot mark activity ${cmid}:`, data.message || data.exception);
    }
    return false;
  } catch (error) {
    console.error(`[Moodle WS] Error updating completion for cmid ${cmid}:`, error);
    return false;
  }
};

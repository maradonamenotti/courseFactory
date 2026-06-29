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

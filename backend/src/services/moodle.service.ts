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
}

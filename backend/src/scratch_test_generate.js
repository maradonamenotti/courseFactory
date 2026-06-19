const { generateHtml } = require('./controllers/systems.controller');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  console.log('Testing generateHtml...');

  // Mock Request
  const req = {
    body: {
      moduleName: 'Introducción',
      rows: [
        {
          id: 'row-1',
          nro: '1',
          modulo: 'Introducción',
          materia: 'METODOLOGÍA DE LA ENSEÑANZA',
          descripcion: 'Presentación: Introducción General a la nueva logica',
          formato: 'VIDEO',
          htmlContent: '', // empty to simulate the problem
          videoVimeo: '',
          links: '',
        }
      ],
      template: {
        id: 'template-1',
        name: 'Plantilla Base',
        design: {
          primaryColor: '#14b8a6',
          secondaryColor: '#9ca3af',
          textColor: '#111827',
          headlineFont: 'Inter',
          bodyFont: 'Inter',
          themeStyle: 'modern',
          languages: 'ES,EN,PT' // Simulating multiple languages
        },
        blocks: [
          {
            id: 'row-1',
            type: 'text',
            customCode: `<div class="block-text" style="margin-bottom: 2rem;">
  <h3>[NRO]. [MODULO]</h3>
  <p>[DESCRIPCION]</p>
</div>`
          }
        ]
      }
    }
  };

  // Mock Response
  const res = {
    status(code) {
      console.log(`Response Status: ${code}`);
      return this;
    },
    json(data) {
      console.log('Response JSON received!');
      console.log('========================================');
      console.log(data.html);
      console.log('========================================');
    }
  };

  // Set active languages for course simulation
  // Since we mock the DB, let's see how generateHtml gets course languages.
  // In systems.controller.ts:
  // const courseId = rows?.[0]?.courseId;
  // If no courseId or course not found, it defaults to ['ES'] unless we override or it finds it.
  // Wait, let's look at systems.controller.ts:
  // If courseId is undefined, languagesList defaults to ['ES'].
  // But wait! In the user's case, the course has ES, EN, PT.
  // So the DB query for the course returns languages = 'ES, EN, PT'.
  // Since we don't have the course in the local DB, we can temporarily modify systems.controller.ts
  // or mock the DB connection, or we can just insert a course into the local DB!
  // Yes! Let's insert a course with ID 'course-1' and languages 'ES,EN,PT' into the local DB,
  // and set row's courseId to 'course-1'.
  
  const { Client } = require('pg');
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'Riverplate912',
    database: 'coursefactory-bdd',
  });
  await client.connect();
  
  // Clean up and insert
  await client.query(`DELETE FROM course_rows WHERE id = 'row-1'`);
  await client.query(`DELETE FROM courses WHERE id = 'course-1'`);
  await client.query(`
    INSERT INTO courses (id, name, languages, "createdAt")
    VALUES ('course-1', 'METODOLOGÍA DE LA ENSEÑANZA', 'ES,EN,PT', NOW())
  `);
  
  req.body.rows[0].courseId = 'course-1';

  // Run the controller function
  try {
    await generateHtml(req, res);
  } catch (err) {
    console.error('Error running generateHtml:', err);
  }

  // Clean up
  await client.query(`DELETE FROM courses WHERE id = 'course-1'`);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

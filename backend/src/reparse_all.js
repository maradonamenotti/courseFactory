const { Pool } = require('pg');
const { parseDocxQuizQuestions, renderInteractiveQuizHtml } = require('./dist/controllers/systems.controller');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Riverplate912',
  database: process.env.DB_NAME || 'coursefactory-bdd'
});

async function main() {
  const res = await pool.query(`SELECT id, modulo, materia, "htmlContent", "questionsPool" FROM course_rows`);
  console.log('Total course rows found:', res.rows.length);
  let updatedCount = 0;

  for (const row of res.rows) {
    if (!row.htmlContent && !row.questionsPool) continue;
    let questions = [];
    if (row.htmlContent) {
      questions = parseDocxQuizQuestions(row.htmlContent);
    }
    if ((!questions || questions.length === 0) && row.questionsPool) {
      try {
        questions = typeof row.questionsPool === 'string' ? JSON.parse(row.questionsPool) : row.questionsPool;
      } catch(e) {}
    }
    if (!questions || !Array.isArray(questions) || questions.length === 0) continue;

    const quizHtml = renderInteractiveQuizHtml(row, questions, null, row.id, true);
    await pool.query(
      `UPDATE course_rows SET "generatedHtml" = $1, "questionsPool" = $2::jsonb WHERE id = $3`,
      [quizHtml, JSON.stringify(questions), row.id]
    );
    updatedCount++;
    console.log(`Updated [${updatedCount}] row ${row.id} (${row.modulo}) with ${questions.length} questions.`);
  }

  console.log(`\nFinished! Successfully updated ${updatedCount} quiz rows.`);
  await pool.end();
}

main().catch(console.error);

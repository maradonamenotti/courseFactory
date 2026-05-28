import nodemailer from 'nodemailer';

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('⚠️ SMTP credentials not fully configured in env variables. Emails will be logged but not sent.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
};

export const sendTaskAlertEmail = async (
  toEmail: string,
  toName: string,
  taskTitle: string,
  taskDescription: string,
  courseName?: string,
  panelName?: string
): Promise<void> => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || '"CourseFactory Alerts" <alerts@coursefactory.app>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nueva Tarea Asignada</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #0b1519;
          color: #e2e8f0;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #112229;
          border: 1px solid rgba(20, 184, 166, 0.2);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        }
        .header {
          background: linear-gradient(135deg, #112229 0%, #14b8a6 100%);
          padding: 30px 20px;
          text-align: center;
          border-bottom: 2px solid #14b8a6;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          color: #ffffff;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 30px 20px;
        }
        .greeting {
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 15px;
        }
        .message {
          font-size: 15px;
          line-height: 1.6;
          color: #94a3b8;
          margin-bottom: 25px;
        }
        .task-card {
          background-color: rgba(20, 184, 166, 0.05);
          border-left: 4px solid #14b8a6;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 25px;
        }
        .task-title {
          font-size: 17px;
          font-weight: 700;
          color: #14b8a6;
          margin: 0 0 10px 0;
        }
        .task-detail {
          font-size: 14px;
          color: #94a3b8;
          margin: 0 0 8px 0;
          line-height: 1.5;
        }
        .task-meta {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .meta-item {
          font-size: 13px;
          color: #64748b;
        }
        .meta-item strong {
          color: #94a3b8;
        }
        .footer {
          background-color: #0b1519;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #475569;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .footer p {
          margin: 0 0 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CourseFactory</h1>
        </div>
        <div class="content">
          <div class="greeting">Hola, ${toName}</div>
          <div class="message">
            Se te ha asignado una nueva tarea u observación en la plataforma CourseFactory. A continuación, encontrás los detalles correspondientes:
          </div>
          <div class="task-card">
            <h2 class="task-title">${taskTitle}</h2>
            ${taskDescription ? `<p class="task-detail">${taskDescription}</p>` : ''}
            <div class="task-meta">
              ${courseName ? `<div class="meta-item"><strong>Curso:</strong> ${courseName}</div>` : ''}
              ${panelName ? `<div class="meta-item"><strong>Panel:</strong> ${panelName}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="footer">
          <p>Este es un correo automático generado por CourseFactory.</p>
          <p>&copy; 2026 Maradona Menotti. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log(`[SIMULACIÓN CORREO] Enviando alerta a ${toName} (${toEmail}):\n- Título: ${taskTitle}\n- Descripción: ${taskDescription}`);
    return;
  }

  try {
    await transporter.sendMail({
      from,
      to: `${toName} <${toEmail}>`,
      subject: `🔔 Nueva Tarea Asignada: ${taskTitle}`,
      html: htmlContent,
    });
    console.log(`📧 Correo de alerta de tarea enviado a ${toEmail} con éxito.`);
  } catch (error) {
    console.error('❌ Error al enviar el correo de alerta de tarea:', error);
  }
};

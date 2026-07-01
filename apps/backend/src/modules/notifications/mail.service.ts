import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * Simula el envío de un correo electrónico institucional con formato premium en consola.
   */
  async sendMail(to: string, subject: string, htmlTemplate: string): Promise<boolean> {
    const apiKey = process.env.BREVO_API_KEY;

    if (apiKey) {
      this.logger.log(`Enviando correo real a ${to} usando Brevo API...`);
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'AsistApp SaaS', email: 'no-reply@asistapp.com' },
            to: [{ email: to }],
            subject: subject,
            htmlContent: htmlTemplate
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.error(`Error de Brevo API (${response.status}): ${errText}`);
          return false;
        }

        this.logger.log(`Correo enviado exitosamente vía Brevo API a ${to}`);
        return true;
      } catch (err: any) {
        this.logger.error(`Error al conectar con Brevo API: ${err.message}`);
        return false;
      }
    }

    // Simular retraso de red
    await new Promise((resolve) => setTimeout(resolve, 500));

    this.logger.log(`
┌────────────────────────────────────────────────────────────────────────┐
│  ✉️  NUEVO CORREO ELECTRÓNICO ENVIADO (MOCK - RESEND/SENDGRID INTEGRATION)   │
├────────────────────────────────────────────────────────────────────────┤
│  Para:      ${to.padEnd(58)} │
│  Asunto:    ${subject.padEnd(58)} │
├────────────────────────────────────────────────────────────────────────┤
│  Cuerpo HTML:                                                          │
│                                                                        │
${htmlTemplate.split('\n').map(line => `│  ${line.slice(0, 70).padEnd(70)} │`).join('\n')}
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
    `);
    return true;
  }

  /**
   * Genera una plantilla premium para alerta de umbral de inasistencias injustificadas (>20%).
   */
  getUnexcusedAbsenceThresholdAlertTemplate(
    studentName: string,
    subjectName: string,
    unexcusedCount: number,
    totalClasses: number,
    unexcusedRate: number
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
    .card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
    .header { background: linear-gradient(135deg, #f43f5e, #be123c); padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
    .content { padding: 32px; line-height: 1.6; }
    .accent { color: #e11d48; font-weight: 700; }
    .stats-box { background-color: #fff1f2; border: 1px solid #ffe4e6; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .stats-val { font-size: 32px; font-weight: 800; color: #be123c; margin: 0; }
    .stats-lbl { font-size: 12px; color: #9f1239; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
    .details { font-size: 13px; color: #4b5563; margin-top: 12px; border-top: 1px solid #f3f4f6; padding-top: 12px; }
    .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>⚠️ UMBRAL CRÍTICO: RIESGO DE REPROBACIÓN ACADÉMICA</h1>
    </div>
    <div class="content">
      <p>Estimado(a) <strong>${studentName}</strong>,</p>
      <p>Te notificamos de forma automática desde la dirección académica de la **Universidad de Deymos** que has superado el límite reglamentario de inasistencias injustificadas en la asignatura de:</p>
      <p style="font-size: 18px; font-weight: 600; text-align: center; margin: 16px 0; color: #0f172a;">${subjectName}</p>
      
      <div class="stats-box">
        <p class="stats-val">${unexcusedRate.toFixed(1)}%</p>
        <p class="stats-lbl">Faltas Injustificadas Acumuladas</p>
        <div class="details">
          Clases Totales: <strong>${totalClasses}</strong> | Faltas Injustificadas: <strong>${unexcusedCount}</strong>
        </div>
      </div>
      
      <p class="accent">IMPORTANTE: Has acumulado más del 20% de inasistencias injustificadas, colocándote en situación de riesgo académico y reprobación inminente por inasistencia (FA) bajo el artículo de reglamento estudiantil.</p>
      <p>Por favor, si cuentas con justificaciones médicas o de fuerza mayor para tus inasistencias, regístralas de inmediato a través del portal de AsistApp para que sean evaluadas por tu coordinador académico. De lo contrario, ponte en contacto con tu docente de inmediato.</p>
    </div>
    <div class="footer">
      Este es un correo automático generado por AsistApp SaaS. Por favor no respondas a este mensaje.
    </div>
  </div>
</body>
</html>
    `.trim();
  }


  /**
   * Genera una plantilla premium de alerta de inasistencia crítica (Asistencia por debajo del 80%)
   */
  getAlertAttendanceCriticalTemplate(studentName: string, subjectName: string, rate: number): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
    .card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
    .header { background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
    .content { padding: 32px; line-height: 1.6; }
    .accent { color: #ef4444; font-weight: 700; }
    .stats-box { background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .stats-val { font-size: 32px; font-weight: 800; color: #b91c1c; margin: 0; }
    .stats-lbl { font-size: 12px; color: #991b1b; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
    .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>⚠️ ALERTA ACADÉMICA: ASISTENCIA CRÍTICA</h1>
    </div>
    <div class="content">
      <p>Estimado(a) <strong>${studentName}</strong>,</p>
      <p>Te notificamos formalmente desde el portal institucional <strong>AsistApp</strong> que has alcanzado un umbral de inasistencia crítico en la asignatura de:</p>
      <p style="font-size: 18px; font-weight: 600; text-align: center; margin: 16px 0; color: #0f172a;">${subjectName}</p>
      <p>Tu porcentaje actual de asistencia en esta materia se encuentra por debajo de la norma académica reglamentaria del <strong>80%</strong>:</p>
      <div class="stats-box">
        <p class="stats-val">${rate.toFixed(1)}%</p>
        <p class="stats-lbl">Porcentaje de Asistencia Actual</p>
      </div>
      <p class="accent">IMPORTANTE: Estás en riesgo inminente de reprobación por inasistencia (FA) si no regularizas tu situación o justificas debidamente tus ausencias recientes.</p>
      <p>Por favor, ponte en contacto de inmediato con tu docente o coordinador de carrera para revisar las alternativas correspondientes.</p>
    </div>
    <div class="footer">
      Este es un correo automático generado por AsistApp. Por favor no respondas a este mensaje.
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Genera una plantilla premium de resolución de justificaciones (Aprobada / Rechazada)
   */
  getJustificationResolutionTemplate(studentName: string, subjectName: string, date: string, status: 'aprobada' | 'rechazada', comments?: string): string {
    const isApproved = status === 'aprobada';
    const statusColor = isApproved ? '#10b981' : '#ef4444';
    const statusText = isApproved ? 'APROBADA' : 'RECHAZADA';
    const headerBg = isApproved 
      ? 'linear-gradient(135deg, #10b981, #047857)' 
      : 'linear-gradient(135deg, #ef4444, #b91c1c)';

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
    .card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
    .header { background: ${headerBg}; padding: 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
    .content { padding: 32px; line-height: 1.6; }
    .badge { display: inline-block; background-color: ${statusColor}15; color: ${statusColor}; font-weight: 700; padding: 6px 16px; border-radius: 9999px; font-size: 14px; border: 1px solid ${statusColor}30; text-transform: uppercase; margin-bottom: 20px; }
    .comments-box { background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 16px; margin: 20px 0; font-style: italic; border-radius: 0 8px 8px 0; }
    .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>ESTADO DE JUSTIFICACIÓN ACTUALIZADO</h1>
    </div>
    <div class="content" style="text-align: center;">
      <p style="text-align: left;">Estimado(a) <strong>${studentName}</strong>,</p>
      <p style="text-align: left;">Te notificamos que la solicitud de justificación para tu inasistencia registrada en la materia de <strong>${subjectName}</strong> el día <strong>${date}</strong> ha sido resuelta:</p>
      
      <div class="badge">${statusText}</div>

      ${comments ? `
        <div style="text-align: left;">
          <p style="margin-bottom: 4px; font-weight: 600;">Comentarios del Coordinador / Supervisor:</p>
          <div class="comments-box">
            "${comments}"
          </div>
        </div>
      ` : ''}

      <p style="text-align: left; margin-top: 24px;">El estado de tu inasistencia en dicha fecha ha sido actualizado automáticamente en el sistema AsistApp.</p>
    </div>
    <div class="footer">
      Este es un correo automático generado por AsistApp. Por favor no respondas a este mensaje.
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

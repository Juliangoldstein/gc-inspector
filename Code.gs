/**
 * GC Inspector — Google Apps Script
 * ─────────────────────────────────────────────────────────────────────────
 * INSTRUCCIONES DE DEPLOY:
 *
 * 1. Ir a script.google.com → Nuevo proyecto
 * 2. Pegar este código completo
 * 3. Configurar las constantes de abajo (SHEET_ID, etc.)
 * 4. Menú → Implementar → Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo (tu cuenta de Google)
 *    - Quién tiene acceso: Cualquier usuario (Anyone)
 * 5. Copiar la URL generada y pegarla en CONFIG.APPS_SCRIPT_URL del index.html
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Configuración ──────────────────────────────────────────────────────────
const CONFIG = {
  // ID del Google Sheet (desde la URL: docs.google.com/spreadsheets/d/ESTE_ID/edit)
  SHEET_ID: 'TU_GOOGLE_SHEET_ID_AQUI',

  // Nombre de la hoja dentro del Sheet
  HOJA_NOMBRE: 'Observaciones',

  // Email del arquitecto (remitente y copia)
  EMAIL_ARQUITECTO: 'julian@goldsteinconstrucciones.com',
};

// ── Columnas del sheet ─────────────────────────────────────────────────────
const COLUMNAS = [
  'ID', 'Obra', 'Plano', 'Página', 'Rubro', 'Descripción',
  'Severidad', 'Responsable', 'Foto adjunta', 'Fecha', 'Estado'
];

// ── POST: recibir observaciones desde la app ──────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { obra, emailEncargado, observaciones } = data;

    if (!observaciones || !observaciones.length) {
      return respuesta(400, 'Sin observaciones');
    }

    const sheet = obtenerOCrearHoja();
    const filas = [];

    observaciones.forEach(obs => {
      filas.push([
        obs.id,
        obra || '—',
        obs.plano || '—',
        obs.pagina || 1,
        obs.rubro || '—',
        obs.desc || '—',
        obs.sev ? obs.sev.charAt(0).toUpperCase() + obs.sev.slice(1) : '—',
        obs.responsable || 'Sin asignar',
        obs.foto || 'No',
        obs.fecha || new Date().toLocaleString('es-AR'),
        'Pendiente',
      ]);
    });

    // Agregar filas al sheet
    const ultimaFila = sheet.getLastRow();
    sheet.getRange(ultimaFila + 1, 1, filas.length, COLUMNAS.length).setValues(filas);

    // Formatear severidad con color
    filas.forEach((fila, i) => {
      const filaN = ultimaFila + 1 + i;
      const sevCell = sheet.getRange(filaN, 7); // columna Severidad
      const sev = fila[6].toLowerCase();
      if (sev === 'alta')  sevCell.setBackground('#FFCCCC').setFontColor('#7A0000');
      if (sev === 'media') sevCell.setBackground('#FFF0CC').setFontColor('#7A4700');
      if (sev === 'baja')  sevCell.setBackground('#CCFFCC').setFontColor('#1A4700');
    });

    // Enviar email al encargado
    if (emailEncargado) {
      enviarEmailEncargado(obra, emailEncargado, observaciones);
    }

    return respuesta(200, `${filas.length} observaciones guardadas`);

  } catch (err) {
    console.error(err);
    return respuesta(500, 'Error interno: ' + err.message);
  }
}

// ── GET: health check ──────────────────────────────────────────────────────
function doGet() {
  return respuesta(200, 'GC Inspector API funcionando');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function obtenerOCrearHoja() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let hoja = ss.getSheetByName(CONFIG.HOJA_NOMBRE);

  if (!hoja) {
    hoja = ss.insertSheet(CONFIG.HOJA_NOMBRE);

    // Encabezados
    const headerRow = hoja.getRange(1, 1, 1, COLUMNAS.length);
    headerRow.setValues([COLUMNAS]);
    headerRow.setBackground('#1a1a1a').setFontColor('#c8a96e').setFontWeight('bold');

    // Anchos de columna
    hoja.setColumnWidth(1, 90);   // ID
    hoja.setColumnWidth(2, 120);  // Obra
    hoja.setColumnWidth(3, 180);  // Plano
    hoja.setColumnWidth(4, 60);   // Página
    hoja.setColumnWidth(5, 140);  // Rubro
    hoja.setColumnWidth(6, 300);  // Descripción
    hoja.setColumnWidth(7, 80);   // Severidad
    hoja.setColumnWidth(8, 140);  // Responsable
    hoja.setColumnWidth(9, 90);   // Foto
    hoja.setColumnWidth(10, 140); // Fecha
    hoja.setColumnWidth(11, 100); // Estado

    hoja.setFrozenRows(1);
  }

  return hoja;
}

function enviarEmailEncargado(obra, emailEncargado, observaciones) {
  const altas = observaciones.filter(o => o.sev === 'alta');
  const medias = observaciones.filter(o => o.sev === 'media');
  const bajas = observaciones.filter(o => o.sev === 'baja');

  const filaHtml = o => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:8px;font-family:monospace;font-weight:bold;color:#B8860B">${o.id}</td>
      <td style="padding:8px">${o.plano} / p.${o.pagina}</td>
      <td style="padding:8px">${o.rubro}</td>
      <td style="padding:8px">${o.desc || '—'}</td>
      <td style="padding:8px;text-align:center">
        <span style="padding:3px 8px;border-radius:4px;font-size:12px;font-weight:bold;
          background:${o.sev==='alta'?'#FFCCCC':o.sev==='media'?'#FFF0CC':'#CCFFCC'};
          color:${o.sev==='alta'?'#7A0000':o.sev==='media'?'#7A4700':'#1A4700'}">
          ${o.sev.charAt(0).toUpperCase()+o.sev.slice(1)}
        </span>
      </td>
      <td style="padding:8px;color:#555">${o.responsable || 'Sin asignar'}</td>
    </tr>
  `;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#111110;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:#c8a96e;margin:0;font-size:18px;font-weight:600">
          GC Inspector — Nuevas observaciones de obra
        </h1>
        <p style="color:#888;margin:6px 0 0;font-size:13px">${obra}</p>
      </div>

      <div style="background:#fff;padding:24px;border:1px solid #e0e0e0">
        <div style="display:flex;gap:16px;margin-bottom:20px">
          ${altas.length ? `<div style="flex:1;background:#FFF0F0;border-radius:6px;padding:12px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:#C0392B">${altas.length}</div>
            <div style="font-size:12px;color:#C0392B">Alta severidad</div>
          </div>` : ''}
          ${medias.length ? `<div style="flex:1;background:#FFF8F0;border-radius:6px;padding:12px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:#D35400">${medias.length}</div>
            <div style="font-size:12px;color:#D35400">Media severidad</div>
          </div>` : ''}
          ${bajas.length ? `<div style="flex:1;background:#F0FFF4;border-radius:6px;padding:12px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:#27AE60">${bajas.length}</div>
            <div style="font-size:12px;color:#27AE60">Baja severidad</div>
          </div>` : ''}
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left">ID</th>
              <th style="padding:8px;text-align:left">Plano / Pág.</th>
              <th style="padding:8px;text-align:left">Rubro</th>
              <th style="padding:8px;text-align:left">Descripción</th>
              <th style="padding:8px;text-align:center">Severidad</th>
              <th style="padding:8px;text-align:left">Responsable</th>
            </tr>
          </thead>
          <tbody>
            ${[...altas, ...medias, ...bajas].map(filaHtml).join('')}
          </tbody>
        </table>

        <p style="margin-top:20px;font-size:12px;color:#888">
          Registrado el ${new Date().toLocaleString('es-AR')} · GC Inspector de Obra
        </p>
      </div>
    </div>
  `;

  GmailApp.sendEmail(emailEncargado, `[${obra}] ${observaciones.length} nuevas observaciones de obra`, '', {
    htmlBody,
    cc: CONFIG.EMAIL_ARQUITECTO,
    name: 'GC Inspector',
    replyTo: CONFIG.EMAIL_ARQUITECTO,
  });
}

function respuesta(codigo, mensaje) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: codigo === 200, mensaje }))
    .setMimeType(ContentService.MimeType.JSON);
}

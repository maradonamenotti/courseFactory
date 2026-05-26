import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CourseRow } from '../entities/CourseRow';
import { Course } from '../entities/Course';

const rowRepo = () => AppDataSource.getRepository(CourseRow);
const courseRepo = () => AppDataSource.getRepository(Course);

// Escapa un valor para CSV (envuelve en comillas si tiene comas, comillas o saltos de línea)
const escapeCsv = (value: string | null | undefined): string => {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// GET /api/courses/:courseId/export
export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;

  const course = await courseRepo().findOne({ where: { id: courseId } });
  if (!course) {
    res.status(404).json({ message: 'Curso no encontrado' });
    return;
  }

  const rows = await rowRepo().find({
    where: { courseId },
    order: { sortOrder: 'ASC' },
  });

  // ─── Cabecera del CSV ────────────────────────────────────────────────────────
  const headers = [
    'Nro',
    'Materia',
    'Módulo',
    'Descripción',
    'Formato',
    'Links',
    'Archivo',
    'URL Archivo',
    'Estado Contenido',
    'Video Drive',
    'Video Vimeo',
    'Subtítulos',
    'URL Genially',
    'Estado Genially (Link)',
    'Estado Genially (Texto)',
    'Estado Genially (Diseño)',
    'Estado Multimedia',
    'Aprobación Contenido',
    'Aprobación Multimedia',
    'Comentarios Revisor',
    'Estado Final',
  ];

  // ─── Filas del CSV ───────────────────────────────────────────────────────────
  const csvRows = rows.map((row, index) => [
    escapeCsv(String(index + 1)),
    escapeCsv(row.materia),
    escapeCsv(row.modulo),
    escapeCsv(row.descripcion),
    escapeCsv(row.formato),
    escapeCsv(row.links),
    escapeCsv(row.fileName),
    escapeCsv(row.fileUrl),
    escapeCsv(row.estado),
    escapeCsv(row.videoDrive),
    escapeCsv(row.videoVimeo),
    escapeCsv(row.videoSubtitulos),
    escapeCsv(row.geniallyUrl),
    escapeCsv(row.geniallyLinkStatus),
    escapeCsv(row.geniallyTextoStatus),
    escapeCsv(row.geniallyDisenoStatus),
    escapeCsv(row.estadoMultimedia),
    escapeCsv(row.aprobacionContenido),
    escapeCsv(row.aprobacionMultimedia),
    escapeCsv(row.comentariosRevisor),
    escapeCsv(row.estadoFinal),
  ].join(','));

  const csvContent = [headers.join(','), ...csvRows].join('\n');

  // Nombre de archivo: slug del curso + fecha
  const dateStr = new Date().toISOString().slice(0, 10);
  const slug = course.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${slug}_${dateStr}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM para que Excel abra correctamente con UTF-8
  res.send('\uFEFF' + csvContent);
};

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Course } from './Course';

@Entity('course_rows')
export class CourseRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Course, (course) => course.rows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  courseId: string;

  @Column({ default: 0 })
  sortOrder: number;

  // ─── Panel 1: Contenido ───────────────────────────────────────────────────
  @Column({ default: '' })
  materia: string;

  @Column({ default: '' })
  modulo: string;

  @Column({ type: 'text', default: '' })
  descripcion: string;

  @Column({ default: 'VIDEO' })
  formato: string; // 'VIDEO' | 'TEXTO' | 'CUESTIONARIO' | 'GENIALLY' | 'PDF' | 'OTRO'

  @Column({ default: '' })
  links: string;

  @Column({ nullable: true, type: 'varchar' })
  fileName: string | null;

  @Column({ nullable: true, type: 'varchar' })
  fileType: string | null;

  @Column({ nullable: true, type: 'varchar' })
  fileUrl: string | null; // URL de Cloudinary o link externo

  @Column({ type: 'text', nullable: true })
  htmlContent: string | null;

  @Column({ default: '1-NO EMPEZADO' })
  estado: string;

  // ─── Panel 2: Multimedia ──────────────────────────────────────────────────
  @Column({ default: '' })
  videoDrive: string;

  @Column({ default: '' })
  videoVimeo: string;

  @Column({ default: 'NO' })
  videoSubtitulos: string;

  @Column({ default: '' })
  geniallyUrl: string;

  @Column({ default: 'NO EMPEZADO' })
  geniallyLinkStatus: string;

  @Column({ default: 'NO EMPEZADO' })
  geniallyTextoStatus: string;

  @Column({ default: 'NO EMPEZADO' })
  geniallyDisenoStatus: string;

  @Column({ default: '1-NO EMPEZADO' })
  estadoMultimedia: string;

  // ─── Panel 3: Verificación ────────────────────────────────────────────────
  @Column({ default: 'PENDIENTE' })
  aprobacionContenido: string;

  @Column({ default: 'PENDIENTE' })
  aprobacionMultimedia: string;

  @Column({ type: 'text', default: '' })
  comentariosRevisor: string;

  @Column({ default: 'NO LISTO' })
  estadoFinal: string;

  @Column({ type: 'text', nullable: true })
  generatedHtml: string | null;

  @Column({ default: 'PENDIENTE' })
  aprobacionDiseno: string; // 'PENDIENTE' | 'APROBADO'
}


import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('course_previews')
export class CoursePreview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'token' })
  token: string;

  @Column({ type: 'text', name: 'html' })
  html: string;

  @Column({ length: 255, default: 'Vista Previa del Curso', name: 'course_name' })
  courseName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', name: 'expires_at' })
  expiresAt: Date;
}

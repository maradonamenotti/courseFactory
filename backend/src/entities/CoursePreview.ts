import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('course_previews')
export class CoursePreview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'token' })
  token: string;

  @Column({ name: 'course_id' })
  courseId: string;

  @Column({ length: 255, default: 'Vista Previa del Curso', name: 'course_name' })
  courseName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

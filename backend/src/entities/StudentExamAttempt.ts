import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('student_exam_attempts')
export class StudentExamAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  studentMoodleId: string;

  @Column({ default: '' })
  alumnoNombre: string;

  @Column()
  @Index()
  courseId: string;

  @Column()
  @Index()
  courseRowId: string;

  @Column({ type: 'integer' })
  attemptNumber: number;

  @Column({ type: 'integer' })
  score: number; // 0 to 100

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({ type: 'jsonb' })
  questions: any; // Las 10 preguntas seleccionadas

  @Column({ type: 'jsonb' })
  answers: any; // Las respuestas dadas por el alumno

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}

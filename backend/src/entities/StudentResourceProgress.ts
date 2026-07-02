import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('student_resource_progress')
@Index(['alumnoMoodleId', 'courseId'])
@Unique(['alumnoMoodleId', 'courseId', 'rowId'])
export class StudentResourceProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  alumnoMoodleId: string;

  @Column({ nullable: true })
  alumnoNombre?: string;

  @Column()
  courseId: string;

  @Column()
  rowId: string;

  @Column({ nullable: true })
  materia?: string;

  @Column({ nullable: true })
  modulo?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'int', default: 0 })
  segundosActivos: number;
}

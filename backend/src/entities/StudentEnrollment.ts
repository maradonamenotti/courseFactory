import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('student_enrollments')
@Unique(['alumnoId', 'courseId'])
export class StudentEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  alumnoId: string;

  @Column()
  @Index()
  courseId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;
}

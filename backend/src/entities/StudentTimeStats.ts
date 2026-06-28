import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
} from 'typeorm';

@Entity('student_time_stats')
@Unique(['alumnoMoodleId', 'courseId', 'fecha'])
export class StudentTimeStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  alumnoMoodleId: string;

  @Column()
  courseId: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'int', default: 0 })
  segundosActivos: number;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type TrackingAction = 'open' | 'click_continuar' | 'finish' | 'quiz_submit';

@Entity('tracking_events')
@Index(['licencia', 'materia'])
@Index(['modulo'])
export class TrackingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  licencia: string;

  @Column()
  materia: string;

  @Column()
  modulo: string;

  @Column({
    type: 'enum',
    enum: ['open', 'click_continuar', 'finish', 'quiz_submit'],
  })
  accion: TrackingAction;

  @Column()
  alumnoMoodleId: string;

  @Column({ nullable: true })
  alumnoNombre?: string;

  @Column({ type: 'int', nullable: true })
  score?: number | null;

  @Column({ type: 'int', nullable: true })
  correctAnswers?: number | null;

  @Column({ type: 'int', nullable: true })
  totalQuestions?: number | null;

  @CreateDateColumn()
  timestamp: Date;
}

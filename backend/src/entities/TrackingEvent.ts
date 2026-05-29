import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type TrackingAction = 'open' | 'click_continuar' | 'finish';

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
    enum: ['open', 'click_continuar', 'finish'],
  })
  accion: TrackingAction;

  @Column()
  alumnoMoodleId: string;

  @Column({ nullable: true })
  alumnoNombre?: string;

  @CreateDateColumn()
  timestamp: Date;
}

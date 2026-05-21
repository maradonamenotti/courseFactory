import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ nullable: true, type: 'uuid' })
  courseId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  courseName: string | null;

  @Column({ nullable: true, type: 'varchar' })
  rowId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  rowNro: string | null;

  @Column({ nullable: true, type: 'varchar' })
  rowModulo: string | null;

  @Column()
  panelName: string;

  @Column()
  createdBy: string;

  @Column()
  createdByName: string;

  @Column()
  assignedTo: string;

  @Column()
  assignedToName: string;

  @Column({ default: 'PENDIENTE' })
  status: string; // 'PENDIENTE' | 'EN_PROCESO' | 'RESUELTO'

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

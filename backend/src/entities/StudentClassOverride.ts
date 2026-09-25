import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('student_class_overrides')
@Index(['alumnoId', 'courseId', 'modulo'], { unique: true })
export class StudentClassOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  @Index()
  alumnoId!: string;

  @Column({ type: 'varchar' })
  @Index()
  courseId!: string;

  @Column({ type: 'varchar' })
  modulo!: string;

  @Column({ type: 'varchar', default: 'REALIZADA' })
  overrideStatus!: 'REALIZADA' | 'PENDIENTE' | 'EN_CURSO';

  @Column({ type: 'varchar', nullable: true })
  updatedBy?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

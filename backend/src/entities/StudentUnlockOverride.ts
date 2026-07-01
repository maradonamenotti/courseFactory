import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('student_unlock_overrides')
@Unique(['alumnoId', 'courseId'])
export class StudentUnlockOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  alumnoId: string;

  @Column()
  @Index()
  courseId: string;

  @Column({ type: 'varchar', default: 'TOTAL' })
  overrideType: string;

  @Column({ nullable: true, type: 'varchar' })
  unlockedUntilMateria: string | null;

  @Column({ nullable: true, type: 'varchar' })
  codeRedeemed: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  unlockedAt: Date;
}

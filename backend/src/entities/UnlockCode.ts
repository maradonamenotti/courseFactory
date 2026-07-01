import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('unlock_codes')
export class UnlockCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  code: string;

  @Column({ type: 'varchar', default: 'TOTAL' })
  type: string;

  @Column({ nullable: true, type: 'varchar' })
  targetMateria: string | null;

  @Column({ nullable: true, type: 'integer' })
  maxUses: number | null;

  @Column({ type: 'integer', default: 0 })
  usedCount: number;

  @Column({ nullable: true, type: 'timestamp' })
  expiresAt: Date | null;

  @Column()
  @Index()
  courseId: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}

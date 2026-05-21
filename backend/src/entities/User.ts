import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  role: string; // 'admin' | 'autor' | 'multimedia' | 'verificador' | 'diseno' | 'sistemas' | 'analitica'

  @Column({ default: false })
  isAdmin: boolean;

  @Column('jsonb', { default: [] })
  allowedPanels: number[];

  @Column()
  passwordHash: string;

  @Column({ default: true })
  mustChangePassword: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

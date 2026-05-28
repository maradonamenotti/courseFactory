import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('folders')
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // 'carrera' | 'licencia'

  @Column({ nullable: true, type: 'uuid' })
  parentId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  year: string | null;

  @Column({ nullable: true, type: 'boolean', default: false })
  isOfficial: boolean | null;

  @Column({ nullable: true, type: 'varchar' })
  color: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

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

  @CreateDateColumn()
  createdAt: Date;
}

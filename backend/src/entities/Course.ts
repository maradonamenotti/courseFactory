import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { CourseRow } from './CourseRow';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'uuid' })
  folderId: string | null;

  @OneToMany(() => CourseRow, (row) => row.course, {
    cascade: true,
    eager: false,
  })
  rows: CourseRow[];

  @CreateDateColumn()
  createdAt: Date;
}

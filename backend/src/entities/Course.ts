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

  @Column({ default: 'ES' })
  languages: string;

  @Column({ type: 'varchar', default: 'FIXED' })
  releaseMode: string; // 'FIXED' | 'RELATIVE'

  @Column({ nullable: true, type: 'varchar' })
  moodleCourseId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  moodleCourseName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

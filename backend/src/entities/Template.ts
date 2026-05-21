import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('jsonb')
  design: object; // CourseDesign

  @Column('jsonb', { default: [] })
  blocks: object[]; // TemplateBlock[]

  @Column('jsonb', { nullable: true })
  customBlockCodes: object | null;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_activities')
@Index(['userId', 'timestamp'])
@Index(['timestamp'])
export class UserActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  userName: string;

  @Column()
  email: string;

  @Column()
  action: string; // 'login' | 'ping' | 'view_panel' | 'edit_row' | 'generate_html' | 'publish_moodle' | 'create_course'

  @Column({ nullable: true })
  panelName?: string;

  @Column({ nullable: true })
  courseId?: string;

  @Column({ nullable: true })
  details?: string;

  @CreateDateColumn()
  timestamp: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'info' | 'warning' | 'alert' | 'event';
  bannerUrl?: string;
  active: boolean;
  linkUrl?: string;
  linkText?: string;
}

export interface CuatrimestreItem {
  id: string;
  name: string; // e.g. "1º Cuatrimestre"
  startDate: string; // YYYY-MM-DD
  moodleUrl?: string;
  cfCourseId?: string;
  statusOverride?: 'available' | 'locked_date' | 'locked_matricula' | 'locked_prereq';
}

export interface LicenciaConfigItem {
  id: string;
  name: string; // e.g. "Licencia CB", "Licencia A", "Licencia PRO"
  badgeText?: string; // e.g. "Oficial Conmebol"
  description?: string;
  requiresPreviousLicencia: boolean;
  requiresMatricula: boolean;
  cuatrimestres: CuatrimestreItem[];
}

@Entity('portal_configs')
export class PortalConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, type: 'uuid' })
  folderId: string | null;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'varchar' })
  subtitle: string | null;

  @Column({ nullable: true, type: 'varchar' })
  slug: string | null;

  @Column({ type: 'text', nullable: true })
  announcements: string | null; // JSON Array of AnnouncementItem

  @Column({ type: 'text', nullable: true })
  licenciasConfig: string | null; // JSON Array of LicenciaConfigItem

  @Column({ nullable: true, type: 'varchar' })
  moodleCourseId: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

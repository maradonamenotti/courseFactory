import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('library_items')
export class LibraryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column()
  formato: string; // 'VIDEO' | 'TEXTO' | 'CUESTIONARIO' | 'GENIALLY' | 'PDF' | 'OTRO'

  @Column({ default: '' })
  links: string;

  @Column({ nullable: true, type: 'varchar' })
  fileName: string | null;

  @Column({ nullable: true, type: 'varchar' })
  fileType: string | null;

  @Column({ nullable: true, type: 'varchar' })
  fileUrl: string | null; // URL de Cloudinary

  @Column({ default: '' })
  videoDrive: string;

  @Column({ default: '' })
  videoVimeo: string;

  @Column({ default: 'NO' })
  videoSubtitulos: string;

  @CreateDateColumn()
  createdAt: Date;
}

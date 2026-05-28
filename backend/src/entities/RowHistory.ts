import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('row_history')
@Index(['rowId', 'createdAt'])
@Index(['courseId', 'createdAt'])
export class RowHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  rowId: string;

  @Column()
  courseId: string;

  @Column()
  userId: string;

  @Column()
  userName: string;

  // Lista de nombres de campo que cambiaron, ej: ["estado", "descripcion"]
  @Column('text', { array: true, default: '{}' })
  changedFields: string[];

  // Descripción legible del cambio, ej: "estado: 1-NO EMPEZADO → 2-EN PROCESO"
  @Column({ type: 'text', default: '' })
  description: string;

  // Panel desde el que se originó el cambio (1=Contenido, 2=Multimedia, 3=Verificación)
  @Column({ default: 1 })
  panel: number;

  // Snapshot completo de la fila ANTES del cambio (para rollback)
  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}

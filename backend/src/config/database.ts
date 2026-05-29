import 'dotenv/config';
import path from 'path';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Folder } from '../entities/Folder';
import { Course } from '../entities/Course';
import { CourseRow } from '../entities/CourseRow';
import { Template } from '../entities/Template';
import { Task } from '../entities/Task';
import { LibraryItem } from '../entities/LibraryItem';
import { RowHistory } from '../entities/RowHistory';
import { TrackingEvent } from '../entities/TrackingEvent';

// Cargar .env con path explícito para garantizar que se lee siempre
config({ path: path.resolve(__dirname, '../../.env') });

const baseConfig = {
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Folder, Course, CourseRow, Template, Task, LibraryItem, RowHistory, TrackingEvent],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: [],
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
};

export const AppDataSource = process.env.DATABASE_URL
  ? new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ...baseConfig,
    })
  : new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: String(process.env.DB_PASSWORD ?? ''),
      database: process.env.DB_NAME || 'coursefactory-bdd',
      ...baseConfig,
    });

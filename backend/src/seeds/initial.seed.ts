import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

dotenv.config();

const DEFAULT_PASSWORD = 'Maradona2026';

const seedUsers = [
  { email: 'admin@escuela.com',      name: 'Director Sistemas',       role: 'admin',        isAdmin: true,  allowedPanels: [1,2,3,4,5,6] },
  { email: 'autor@escuela.com',      name: 'Autor Contenidos',        role: 'autor',        isAdmin: false, allowedPanels: [1] },
  { email: 'multimedia@escuela.com', name: 'Editor Multimedia',       role: 'multimedia',   isAdmin: false, allowedPanels: [2] },
  { email: 'verificador@escuela.com',name: 'Verificador Calidad',     role: 'verificador',  isAdmin: false, allowedPanels: [3] },
  { email: 'diseno@escuela.com',     name: 'Diseñador Instruccional', role: 'diseno',       isAdmin: false, allowedPanels: [4] },
  { email: 'sistemas@escuela.com',   name: 'Admin LMS',               role: 'sistemas',     isAdmin: false, allowedPanels: [5] },
  { email: 'analitica@escuela.com',  name: 'Analista de Datos',       role: 'analitica',    isAdmin: false, allowedPanels: [6] },
  { email: 'mcastro@maradonamenotti.com.ar', name: 'Manuela Castro',  role: 'admin',        isAdmin: true,  allowedPanels: [1,2,3,4,5,6,7] },
  { email: 'sistemas@maradonamenotti.ar',     name: 'Federico Suarez del Solar', role: 'admin', isAdmin: true,  allowedPanels: [1,2,3,4,5,6,7] },
];

async function seed() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);

  console.log('🌱 Iniciando seed de usuarios...');

  for (const u of seedUsers) {
    const existing = await userRepo.findOne({ where: { email: u.email } });
    if (existing) {
      console.log(`⏭️  Usuario ya existe: ${u.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const user = userRepo.create({
      ...u,
      passwordHash,
      mustChangePassword: u.role !== 'admin', // admin no necesita cambiar
    });

    await userRepo.save(user);
    console.log(`✅ Usuario creado: ${u.email} (${u.role})`);
  }

  console.log('\n🎉 Seed completado!');
  console.log(`📧 Password por defecto: ${DEFAULT_PASSWORD}`);
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});

import 'reflect-metadata';
import dotenv from 'dotenv';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

dotenv.config();

async function main() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const emails = ['mcastro@maradonamenotti.com.ar', 'sistemas@maradonamenotti.ar'];
  
  console.log('🔄 Buscando y actualizando privilegios de superadministrador...');
  
  for (const email of emails) {
    const user = await userRepo.findOne({ where: { email } });
    if (user) {
      user.role = 'admin';
      user.isAdmin = true;
      user.canEdit = true;
      user.canDelete = true;
      user.allowedPanels = [1, 2, 3, 4, 5, 6, 7];
      await userRepo.save(user);
      console.log(`✅ Promocionado a superadministrador con éxito: ${email}`);
    } else {
      console.log(`⚠️  Usuario no encontrado aún en la base de datos: ${email} (se creará automáticamente como superadmin cuando inicie sesión con Google)`);
    }
  }
  
  await AppDataSource.destroy();
}

main().catch(console.error);

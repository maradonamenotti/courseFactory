const { AppDataSource } = require('../dist/config/database.js');

async function run() {
  console.log('Iniciando sincronización de base de datos...');
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('Conectado a la base de datos. Sincronizando schema...');
    await AppDataSource.synchronize(false);
    console.log('✅ Base de datos sincronizada con éxito sin pérdida de datos!');
  } catch (err) {
    console.error('❌ Error al sincronizar base de datos:', err);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

run();

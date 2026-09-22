const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { id: 'admin', role: 'admin', email: 'admin@maradonamenotti.ar' },
  'coursefactory_super_secret_2026_cambiar_en_produccion',
  { expiresIn: '1h' }
);
console.log(token);

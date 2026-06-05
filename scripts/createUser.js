const dotenv = require('dotenv');
dotenv.config();

const UserService = require('../services/UserService');

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = raw[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const name = args.name;
  const email = args.email;
  const password = args.password;
  const estado = args.estado !== undefined ? Number(args.estado) : 1;
  const role = args.role || 'user';

  if (!name || !email || !password) {
    console.error('Uso: node scripts/createUser.js --name "Nombre" --email "user@ejemplo" --password "pass" [--estado 1] [--role user|admin]');
    process.exit(1);
  }

  try {
    const created = await UserService.createUser({ name, email, password, estado, role });
    console.log('Usuario creado:', created);
    process.exit(0);
  } catch (err) {
    console.error('Error creando usuario:', err.message || err);
    process.exit(2);
  }
}

main();

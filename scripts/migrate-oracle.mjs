import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('--- Iniciando migrações Oracle para netWave (prefixo NW_) ---');
  
  const conn = await oracledb.getConnection({
    connectString: process.env.ORACLE_CONNECTION_STRING,
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
  });

  const migrationsDir = path.resolve(__dirname, '../migrations/oracle');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`\nExecutando migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Split by semicolons that are at the end of statements
    // But be careful: in SQL files, semicolons might be inside comments or strings
    // A clean regex split by ; followed by newline or EOF
    const rawStatements = content.split(/;\s*(\r?\n|$)/);

    for (let raw of rawStatements) {
      if (!raw) continue;
      // Remove SQL comments
      const lines = raw.split(/\r?\n/).filter(line => !line.trim().startsWith('--'));
      const stmt = lines.join('\n').trim();
      if (!stmt) continue;

      const firstLine = stmt.split('\n')[0].substring(0, 80);
      try {
        console.log(`  -> Executando: ${firstLine}...`);
        await conn.execute(stmt);
        console.log(`     OK!`);
      } catch (err) {
        if (err.errorNum === 955 || err.errorNum === 1430) {
          console.log(`     [Já existe]: ${err.message.split('\n')[0]}`);
        } else {
          console.error(`     [FALHA]: ${err.message}`);
          console.error(`     SQL com erro:\n${stmt}`);
          throw err;
        }
      }
    }
    console.log(`Migration ${file} finalizada!`);
  }

  const res = await conn.execute("SELECT table_name FROM user_tables WHERE table_name LIKE 'NW_%' ORDER BY table_name");
  console.log(`\nTabelas NW_ presentes no Oracle (${res.rows.length}):`);
  res.rows.forEach(r => console.log(`  - ${r[0]}`));

  await conn.close();
  console.log('\n--- Migrações Oracle concluídas com êxito! ---');
}

runMigrations().catch(err => {
  console.error('Falha crítica nas migrações:', err);
  process.exit(1);
});

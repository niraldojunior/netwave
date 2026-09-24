import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resetSchema() {
  console.log('--- Limpando e recriando schema Oracle para netWave (sem campanha/buffer) ---');
  
  const conn = await oracledb.getConnection({
    connectString: process.env.ORACLE_CONNECTION_STRING,
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
  });

  // 1. Drop existing NW_ views
  const viewsRes = await conn.execute("SELECT view_name FROM user_views WHERE view_name LIKE 'NW_%'");
  for (const row of viewsRes.rows || []) {
    const vName = row[0];
    console.log(`Dropando view ${vName}...`);
    try {
      await conn.execute(`DROP VIEW ${vName}`);
    } catch (e) {
      console.log(`  Erro ao dropar ${vName}: ${e.message}`);
    }
  }

  // 2. Drop existing NW_ tables with CASCADE CONSTRAINTS
  const tablesRes = await conn.execute("SELECT table_name FROM user_tables WHERE table_name LIKE 'NW_%'");
  for (const row of tablesRes.rows || []) {
    const tName = row[0];
    console.log(`Dropando tabela ${tName} CASCADE CONSTRAINTS...`);
    try {
      await conn.execute(`DROP TABLE ${tName} CASCADE CONSTRAINTS PURGE`);
    } catch (e) {
      console.log(`  Erro ao dropar ${tName}: ${e.message}`);
    }
  }

  // 3. Executar as migrações limpas 001 e 002
  const migrationsDir = path.resolve(__dirname, '../migrations/oracle');
  const files = ['001-baseline-nw-tables.sql', '002-nw-indexes-and-constraints.sql'];

  for (const file of files) {
    console.log(`\nExecutando migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const rawStatements = content.split(/;\s*(\r?\n|$)/);

    for (let raw of rawStatements) {
      if (!raw) continue;
      const lines = raw.split(/\r?\n/).filter(line => !line.trim().startsWith('--'));
      const stmt = lines.join('\n').trim();
      if (!stmt) continue;

      const firstLine = stmt.split('\n')[0].substring(0, 80);
      try {
        console.log(`  -> Executando: ${firstLine}...`);
        await conn.execute(stmt);
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
    console.log(`Migration ${file} finalizada com sucesso!`);
  }

  const res = await conn.execute("SELECT table_name FROM user_tables WHERE table_name LIKE 'NW_%' ORDER BY table_name");
  console.log(`\nTabelas NW_ presentes no Oracle (${res.rows.length}):`);
  res.rows.forEach(r => console.log(`  - ${r[0]}`));

  await conn.close();
  console.log('\n--- Schema limpo com sucesso! ---');
}

resetSchema().catch(err => {
  console.error('Falha crítica:', err);
  process.exit(1);
});

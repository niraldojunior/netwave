import oracledb from 'oracledb';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const conn = await oracledb.getConnection({
    connectString: process.env.ORACLE_CONNECTION_STRING,
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
  });
  const res = await conn.execute("SELECT table_name FROM user_tables WHERE table_name LIKE 'NW_%' ORDER BY table_name");
  console.log('Existing NW_ tables count:', res.rows.length);
  console.log('Tables:', res.rows.map(r => r[0]));
  await conn.close();
}

check().catch(console.error);

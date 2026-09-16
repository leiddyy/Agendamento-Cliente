const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  db.serialize(async () => {
    // 1. Tabela Admins
    await runAsync(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Tabela Serviços
    await runAsync(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        duration_minutes INTEGER NOT NULL,
        description TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Tabela Agendamentos
    await runAsync(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        service_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT DEFAULT 'confirmado',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id)
      )
    `);

    // 4. Tabela Configurações
    await runAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Inserir Admin padrão se não existir (admin / admin123)
    const adminExists = await getAsync(`SELECT * FROM admins WHERE username = ?`, ['admin']);
    if (!adminExists) {
      const hash = await bcrypt.hash('admin123', 10);
      await runAsync(
        `INSERT INTO admins (username, password_hash, name) VALUES (?, ?, ?)`,
        ['admin', hash, 'Administradora do Studio']
      );
      console.log('✔ Conta admin padrão criada: admin / admin123');
    }

    // Inserir Configurações Padrão
    const defaultSettings = [
      { key: 'opening_time', value: '08:00' },
      { key: 'closing_time', value: '19:00' },
      { key: 'lunch_start', value: '12:00' },
      { key: 'lunch_end', value: '13:00' },
      { key: 'working_days', value: '1,2,3,4,5,6' }, // Seg a Sáb (0=Dom, 1=Seg, ..., 6=Sáb)
      { key: 'whatsapp_number', value: '5581988448576' },
      { key: 'studio_name', value: 'Eduarda Souza Estética' }
    ];

    for (const setting of defaultSettings) {
      const exists = await getAsync(`SELECT * FROM settings WHERE key = ?`, [setting.key]);
      if (!exists) {
        await runAsync(`INSERT INTO settings (key, value) VALUES (?, ?)`, [setting.key, setting.value]);
      }
    }

    // Atualiza nome legado se ainda estiver como padrão anterior
    await runAsync(`UPDATE settings SET value = ? WHERE key = 'studio_name' AND (value = 'Studio Cílios & Sobrancelhas' OR value = 'Studio Cílios & Sobrancelhas')`, ['Eduarda Souza Estética']);

    // Inserir Serviços Iniciais de Exemplo se a tabela estiver vazia
    const servicesCount = await getAsync(`SELECT COUNT(*) as count FROM services`);
    if (servicesCount.count === 0) {
      const sampleServices = [
        {
          name: 'Design de Sobrancelhas',
          category: 'Sobrancelhas',
          price: 45.00,
          duration_minutes: 30,
          description: 'Mapeamento facial completo com alinhamento e limpeza profissional dos fios.'
        },
        {
          name: 'Design com Henna',
          category: 'Sobrancelhas',
          price: 65.00,
          duration_minutes: 45,
          description: 'Design de sobrancelha personalizado com aplicação de henna para maior preenchimento e destaque.'
        },
        {
          name: 'Micropigmentação Shadow',
          category: 'Sobrancelhas',
          price: 350.00,
          duration_minutes: 120,
          description: 'Técnica de micropigmentação efeito maquiagem suave, durabilidade de até 1 ano.'
        },
        {
          name: 'Extensão de Cílios Fio a Fio',
          category: 'Cílios',
          price: 120.00,
          duration_minutes: 90,
          description: 'Aplicação de um fio sintético leve sobre cada fio natural para um olhar marcante e natural.'
        },
        {
          name: 'Extensão de Cílios Volume Russo',
          category: 'Cílios',
          price: 160.00,
          duration_minutes: 120,
          description: 'Aplicação de leques de fios ultrafinos para máximo volume, preenchimento e glamour.'
        },
        {
          name: 'Lash Lifting com Tintura',
          category: 'Cílios',
          price: 110.00,
          duration_minutes: 60,
          description: 'Curvatura e tintura natural dos próprios cílios, hidratação profunda com durabilidade de até 45 dias.'
        },
        {
          name: 'Combo Glamour (Design com Henna + Lash Lifting)',
          category: 'Combos',
          price: 155.00,
          duration_minutes: 90,
          description: 'O combo ideal para transformar seu olhar em uma única sessão.'
        }
      ];

      for (const s of sampleServices) {
        await runAsync(
          `INSERT INTO services (name, category, price, duration_minutes, description) VALUES (?, ?, ?, ?, ?)`,
          [s.name, s.category, s.price, s.duration_minutes, s.description]
        );
      }
      console.log('✔ Serviços de exemplo cadastrados com sucesso.');
    }
  });
}

initDb();

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync
};

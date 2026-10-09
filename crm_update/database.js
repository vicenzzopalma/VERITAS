const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');

const nameToSector = {
  // Junior
  'Vinicius Correia': 'Junior',
  'Maria Gabriela': 'Junior',
  'Alicia': 'Junior',
  'Izaac Amorim': 'Junior',
  'Pattricia Martins': 'Junior',
  'Gabrielly Castro': 'Junior',
  'Paola Rocha': 'Junior',
  'Arthur Cardoso': 'Junior',
  'Ademar Neto': 'Junior',
  'Ludmila Domingues': 'Junior',
  'Fernanda Lopes': 'Junior',
  'Laiz Alves': 'Junior',
  'Sthefanny Santos': 'Junior',
  'Joao Miranda': 'Junior',
  'Ana Badio': 'Junior',
  'Felipe Braz': 'Junior',
  'Colaborador Teste': 'Junior',
  
  // Pesquisa
  'Maria Rocha': 'Pesquisa',
  'Heloisa': 'Pesquisa',
  'Maria Maximiano': 'Pesquisa',

  // PA FIXA 1
  'Caio Aguiar': 'PA FIXA 1',
  'Maiara Fernandes': 'PA FIXA 1',
  'Nicoly Freitas': 'PA FIXA 1',
  'Helena': 'PA FIXA 1',
  'Gustavo': 'PA FIXA 1',
  'Isabelly Machado': 'PA FIXA 1',
  'Gabriela': 'PA FIXA 1',
  'Gisele': 'PA FIXA 1',
  'Alexsandro': 'PA FIXA 1',
  'Denver': 'PA FIXA 1',
  'Julia Krapp': 'PA FIXA 1',
  'Ana Facioli': 'PA FIXA 1',
  'Julia Mello': 'PA FIXA 1',
  'Eloyse': 'PA FIXA 1',
  'Natalia': 'PA FIXA 1',
  'Beatriz': 'PA FIXA 1',

  // PA FIXA 2
  'Kamilly Caetano': 'PA FIXA 2',
  'Leticia Cattoni': 'PA FIXA 2',
  'Nayumi Amaral': 'PA FIXA 2',
  'Beatriz Caetano': 'PA FIXA 2',
  'Beatriz Martins': 'PA FIXA 2',

  // Senior
  'ANDIANARA TAIS RAUTTA': 'Senior',
  'TALITA SILVA': 'Senior',
  'BRUNA ANJOS': 'Senior',
  'BRUNA REIS': 'Senior',
  'PRISSILA SOARES': 'Senior',
  'EMILY SILVA': 'Senior',
  'LARISSA': 'Senior',
  'DAVI ANGELO LEITE': 'Senior',
  'LAURIANE CASTRO': 'Senior',
  'CAROLINE AZEVEDO': 'Senior',
  'EDSON DOS SANTOS': 'Senior',
  'GRAZIELA PRADO': 'Senior',
  'JEAN VASCONCELOS': 'Senior',
  'JULIANA VEIGA': 'Senior',
  'LIDIANE': 'Senior',
  'HELENA KORMANN': 'Senior',
  'GREICE DUARTE': 'Senior',
  'IZABELLE SANTOS': 'Senior',
  'GUSTAVO VINICIUS': 'Senior',
  'LETICIA CORDEIRO': 'Senior',
  'ROBERTO': 'Senior',
  'JONAS DA SILVA': 'Senior',
  'MARILIA ARINS': 'Senior',
  'WEDLEY': 'Senior',
  'Emilly Rodrigues': 'Senior',
  'Juliana Vilas': 'Senior',
  'Vitoria': 'Senior',
  'Julia Faez': 'Senior',
  'ANNA BEATRIZ SANTANA NOGUEIRA DA SILVA': 'Senior',
  'Natalia Reinert': 'Senior',
  'Eduarda Reinert': 'Senior',
  'Aline Souza': 'Senior',
  'Thaciane Freisle': 'Senior',
  'Nicolle Souza': 'Senior',
  'Maria Roseno': 'Senior',
  'Vitoria Comercial': 'Senior',
  'Nilmara': 'Senior',
  'Anna Recepção': 'Senior',
  'Fabiely': 'Senior',
  'Yasmin.Rosa': 'Senior',
  'JANAINA.JUTTEL': 'Senior',
  'Lucas': 'Senior',
  'Tailane': 'Senior',
  'Leandro TI': 'Senior',
  'Gabriele Silva': 'Senior',
  'Mariana': 'Senior',
};

let db;

async function initDb() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Otimizações físicas para SQLite (concorrência e resiliência)
  await db.run('PRAGMA journal_mode = WAL');
  await db.run('PRAGMA synchronous = NORMAL');
  await db.run('PRAGMA busy_timeout = 5000');
  await db.run('PRAGMA foreign_keys = ON');

  // Verificar se precisamos rodar a migração para a nomenclatura corporativa, ciclo de vida e controle de concorrência
  const isMigrated = await db.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name='numbers' AND sql LIKE '%pk_numbers%' AND sql LIKE '%versao%'");
  
  if (!isMigrated) {
    console.log('Iniciando migração de governança de dados para nomenclatura corporativa e ciclo de vida...');
    await db.run('PRAGMA foreign_keys = OFF');
    await db.run('BEGIN TRANSACTION');

    const migrateTable = async (tableName, newCreateSql, selectColumns) => {
      const tableExists = await db.get("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?", [tableName]);
      if (tableExists) {
        // Verificar quais colunas realmente existem na tabela antiga
        const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
        const existingCols = tableInfo.map(col => col.name);
        
        // Filtrar as colunas requisitadas que existem na tabela antiga
        const colsToSelect = selectColumns
          .split(',')
          .map(c => c.trim())
          .filter(c => existingCols.includes(c));
        
        const colsQueryStr = colsToSelect.join(', ');

        await db.run(`ALTER TABLE ${tableName} RENAME TO temp_${tableName}`);
        await db.run(newCreateSql);
        
        if (colsToSelect.length > 0) {
          await db.run(`INSERT INTO ${tableName} (${colsQueryStr}) SELECT ${colsQueryStr} FROM temp_${tableName}`);
        }
        await db.run(`DROP TABLE temp_${tableName}`);
      } else {
        await db.run(newCreateSql);
      }
    };

    // 1. Tabela users (com is_readonly, allow_all_tabs, ramal, ciclo de vida, permissões de celulares e usuários)
    await migrateTable('users', `
      CREATE TABLE users (
        id INTEGER CONSTRAINT pk_users PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        allow_all_tabs INTEGER DEFAULT 0,
        is_readonly INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        allow_edit_devices INTEGER DEFAULT 0,
        allow_manage_users INTEGER DEFAULT 0,
        allow_dashboard INTEGER DEFAULT 0,
        email TEXT,
        role TEXT DEFAULT 'MANAGER',
        ramal TEXT,
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        excluido_em TEXT,
        CONSTRAINT uk_users_username UNIQUE (username)
      );
    `, 'id, username, password_hash, name, allow_all_tabs, is_readonly, is_active, allow_edit_devices, allow_manage_users, allow_dashboard, ramal, criado_em, atualizado_em, excluido_em');

    // 2. Tabela devices (com ciclo de vida)
    await migrateTable('devices', `
      CREATE TABLE devices (
        id INTEGER CONSTRAINT pk_devices PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sector TEXT NOT NULL,
        origin_sector TEXT DEFAULT 'Junior',
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        excluido_em TEXT
      );
    `, 'id, name, sector, origin_sector, criado_em, atualizado_em, excluido_em');

    // 3. Tabela numbers (com ciclo de vida e concorrência otimista)
    await migrateTable('numbers', `
      CREATE TABLE numbers (
        id INTEGER CONSTRAINT pk_numbers PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        phone_number TEXT NOT NULL,
        name TEXT DEFAULT '',
        status TEXT NOT NULL,
        restricted_until TEXT,
        restricted_at TEXT,
        alarm_active INTEGER DEFAULT 0,
        holder TEXT DEFAULT '',
        versao INTEGER DEFAULT 0,
        site_history_active INTEGER DEFAULT 0,
        in_hand INTEGER DEFAULT 0,
        veritas_status TEXT DEFAULT 'OFFLINE',
        veritas_last_seen TEXT,
        veritas_name TEXT,
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        excluido_em TEXT,
        CONSTRAINT fk_numbers_devices FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      );
    `, 'id, device_id, phone_number, name, status, restricted_until, restricted_at, alarm_active, holder, versao, site_history_active, in_hand, veritas_status, veritas_last_seen, veritas_name, criado_em, atualizado_em, excluido_em');

    // 4. Tabela audit_logs
    await migrateTable('audit_logs', `
      CREATE TABLE audit_logs (
        id INTEGER CONSTRAINT pk_audit_logs PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        user_name TEXT NOT NULL,
        device_name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        holder TEXT DEFAULT '',
        action TEXT NOT NULL,
        sector TEXT
      );
    `, 'id, timestamp, user_name, device_name, phone_number, holder, action, sector');

    // 5. Tabela user_sector_permissions
    await migrateTable('user_sector_permissions', `
      CREATE TABLE user_sector_permissions (
        id INTEGER CONSTRAINT pk_user_sector_permissions PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        sector TEXT NOT NULL,
        can_view INTEGER DEFAULT 1,
        can_configure INTEGER DEFAULT 0,
        CONSTRAINT fk_user_sector_permissions_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uk_user_sector_permissions_user_sector UNIQUE (user_id, sector)
      );
    `, 'id, user_id, sector, can_view, can_configure');

    // 6. Tabela reservation_usage_logs
    await migrateTable('reservation_usage_logs', `
      CREATE TABLE reservation_usage_logs (
        id INTEGER CONSTRAINT pk_reservation_usage_logs PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        device_name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        chip_name TEXT NOT NULL,
        user_assigned TEXT NOT NULL,
        assigned_by TEXT NOT NULL,
        sector TEXT
      );
    `, 'id, timestamp, device_name, phone_number, chip_name, user_assigned, assigned_by, sector');

    // 7. Tabela collaborators (com ciclo de vida)
    await migrateTable('collaborators', `
      CREATE TABLE collaborators (
        id INTEGER CONSTRAINT pk_collaborators PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        ramal TEXT,
        sector TEXT DEFAULT 'Junior',
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
        excluido_em TEXT,
        CONSTRAINT uk_collaborators_name UNIQUE (name)
      );
    `, 'id, name, ramal, sector, criado_em, atualizado_em, excluido_em');

    // 8. Tabela idempotency_keys
    await db.run(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT CONSTRAINT pk_idempotency_keys PRIMARY KEY,
        response_status INTEGER NOT NULL,
        response_body TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.run('COMMIT');
    await db.run('PRAGMA foreign_keys = ON');
    console.log('Migração de governança de dados concluída com sucesso!');
  }

  // Migrar banco de dados existente adicionando a coluna 'name' se ela não existir
  try {
    await db.exec('ALTER TABLE numbers ADD COLUMN name TEXT DEFAULT ""');
    console.log('Coluna name adicionada com sucesso na tabela numbers (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'holder' na tabela numbers se não existir
  try {
    await db.exec('ALTER TABLE numbers ADD COLUMN holder TEXT DEFAULT ""');
    console.log('Coluna holder adicionada com sucesso na tabela numbers (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'restricted_at' na tabela numbers se não existir
  try {
    await db.exec('ALTER TABLE numbers ADD COLUMN restricted_at TEXT');
    console.log('Coluna restricted_at adicionada com sucesso na tabela numbers (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'sector' na tabela collaborators se não existir
  try {
    await db.exec('ALTER TABLE collaborators ADD COLUMN sector TEXT DEFAULT "Junior"');
    console.log('Coluna sector adicionada com sucesso na tabela collaborators (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'origin_sector' na tabela devices se não existir
  try {
    await db.exec('ALTER TABLE devices ADD COLUMN origin_sector TEXT DEFAULT "Junior"');
    console.log('Coluna origin_sector adicionada com sucesso na tabela devices (migração).');
    await db.run('UPDATE devices SET origin_sector = sector WHERE origin_sector IS NULL OR origin_sector = "" OR origin_sector = "Junior"');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'allow_all_tabs' na tabela users se não existir
  try {
    await db.exec('ALTER TABLE users ADD COLUMN allow_all_tabs INTEGER DEFAULT 0');
    console.log('Coluna allow_all_tabs adicionada com sucesso na tabela users (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'is_readonly' na tabela users se não existir
  try {
    await db.exec('ALTER TABLE users ADD COLUMN is_readonly INTEGER DEFAULT 0');
    console.log('Coluna is_readonly adicionada com sucesso na tabela users (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'is_active' na tabela users se não existir
  try {
    await db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1');
    console.log('Coluna is_active adicionada com sucesso na tabela users (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'ramal' na tabela users se não existir
  try {
    await db.exec('ALTER TABLE users ADD COLUMN ramal TEXT');
    console.log('Coluna ramal adicionada com sucesso na tabela users (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'allow_edit_devices' na tabela users se não existir
  try {
    await db.exec('ALTER TABLE users ADD COLUMN allow_edit_devices INTEGER DEFAULT 0');
    console.log('Coluna allow_edit_devices adicionada com sucesso na tabela users (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'allow_manage_users' na tabela users se não existir
  try {
    await db.exec('ALTER TABLE users ADD COLUMN allow_manage_users INTEGER DEFAULT 0');
    console.log('Coluna allow_manage_users adicionada com sucesso na tabela users (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'allow_dashboard' na tabela users se não existir
  try {
    await db.exec('ALTER TABLE users ADD COLUMN allow_dashboard INTEGER DEFAULT 0');
    console.log('Coluna allow_dashboard adicionada com sucesso na tabela users (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  try { await db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch (err) {}
  try { await db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'MANAGER'"); } catch (err) {}
  await db.run("UPDATE users SET role = 'MASTER', email = 'vicenzzo.mastronikolis@realess.com.br' WHERE LOWER(username) = 'vicenzzo'");
  await db.run("UPDATE users SET role = 'VIEWER' WHERE is_readonly = 1 AND LOWER(username) <> 'vicenzzo'");
  await db.run("UPDATE users SET role = 'MANAGER' WHERE (role IS NULL OR role = '') AND is_readonly = 0 AND LOWER(username) <> 'vicenzzo'");

  // Migrar banco de dados existente adicionando a coluna 'holder' na tabela audit_logs se não existir
  try {
    await db.exec('ALTER TABLE audit_logs ADD COLUMN holder TEXT DEFAULT ""');
    console.log('Coluna holder adicionada com sucesso na tabela audit_logs (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'sector' nas tabelas de logs
  try {
    await db.exec('ALTER TABLE audit_logs ADD COLUMN sector TEXT');
    console.log('Coluna sector adicionada com sucesso na tabela audit_logs (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  try {
    await db.exec('ALTER TABLE reservation_usage_logs ADD COLUMN sector TEXT');
    console.log('Coluna sector adicionada com sucesso na tabela reservation_usage_logs (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'site_history_active' na tabela numbers se não existir
  try {
    await db.exec('ALTER TABLE numbers ADD COLUMN site_history_active INTEGER DEFAULT 0');
    console.log('Coluna site_history_active adicionada com sucesso na tabela numbers (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando a coluna 'in_hand' na tabela numbers se não existir
  try {
    await db.exec('ALTER TABLE numbers ADD COLUMN in_hand INTEGER DEFAULT 0');
    console.log('Coluna in_hand adicionada com sucesso na tabela numbers (migração).');
  } catch (err) {
    // A coluna já existe, ignora o erro
  }

  // Migrar banco de dados existente adicionando colunas do VERITAS na tabela numbers se não existirem
  try {
    await db.exec("ALTER TABLE numbers ADD COLUMN veritas_status TEXT DEFAULT 'OFFLINE'");
    console.log('Coluna veritas_status adicionada com sucesso na tabela numbers (migração).');
  } catch (err) {}
  try {
    await db.exec("ALTER TABLE numbers ADD COLUMN veritas_last_seen TEXT");
    console.log('Coluna veritas_last_seen adicionada com sucesso na tabela numbers (migração).');
  } catch (err) {}
  try {
    await db.exec("ALTER TABLE numbers ADD COLUMN veritas_name TEXT");
    console.log('Coluna veritas_name adicionada com sucesso na tabela numbers (migração).');
  } catch (err) {}

  // Migração: Atualizar qualquer aparelho do setor 'PA FIXA' para 'PA FIXA 1'
  try {
    const affected = await db.run("UPDATE devices SET sector = 'PA FIXA 1' WHERE sector = 'PA FIXA'");
    if (affected.changes > 0) {
      console.log(`Migrados ${affected.changes} aparelhos do setor 'PA FIXA' para 'PA FIXA 1'.`);
    }
  } catch (err) {
    console.error('Erro ao migrar aparelhos de PA FIXA para PA FIXA 1:', err);
  }

  // Inserir usuários padrão se não existirem
  const defaultUsers = [
    { username: 'vicenzzo', name: 'Vicenzzo Palma', password: 'vicenzzo123', ramal: 'realess-194' },
    { username: 'gestora2', name: 'Gestora', password: 'gestora123', ramal: 'realess-195' },
    { username: 'ademarneto', name: 'Ademar Neto', ramal: 'realess-1935' },
    { username: 'alicia', name: 'Alicia', ramal: 'realess-1928' },
    { username: 'andianara', name: 'ANDIANARA TAIS RAUTTA', ramal: 'realess-1939' },
    { username: 'arthurcardoso', name: 'Arthur Cardoso', ramal: 'realess-1923' },
    { username: 'brunaanjos', name: 'BRUNA ANJOS', ramal: 'realess-1903' },
    { username: 'brunareis', name: 'BRUNA REIS', ramal: 'realess-1920' },
    { username: 'carolineazevedo', name: 'CAROLINE AZEVEDO', ramal: 'realess-1985' },
    { username: 'daviangelo', name: 'DAVI ANGELO LEITE', ramal: 'realess-1974' },
    { username: 'edsondossantos', name: 'EDSON DOS SANTOS', ramal: 'realess-1970' },
    { username: 'emilysilva', name: 'EMILY SILVA', ramal: 'realess-1952' },
    { username: 'fernandalopes', name: 'Fernanda Lopes', ramal: 'realess-1932' },
    { username: 'gabriellycastro', name: 'Gabrielly Castro', ramal: 'realess-1922' },
    { username: 'grazielaprado', name: 'GRAZIELA PRADO', ramal: 'realess-1938' },
    { username: 'greiceduarte', name: 'GREICE DUARTE', ramal: 'realess-1930' },
    { username: 'gustavovinicius', name: 'GUSTAVO VINICIUS', ramal: 'realess-1905' },
    { username: 'helenakormann', name: 'HELENA KORMANN', ramal: 'realess-1906' },
    { username: 'izaacamorim', name: 'Izaac Amorim', ramal: 'realess-1914' },
    { username: 'izabellesantos', name: 'IZABELLE SANTOS', ramal: 'realess-1933' },
    { username: 'jeanvasconcelos', name: 'JEAN VASCONCELOS', ramal: 'realess-1945' },
    { username: 'jonasdasilva', name: 'JONAS DA SILVA', ramal: 'realess-1917' },
    { username: 'julianaveiga', name: 'JULIANA VEIGA', ramal: 'realess-1929' },
    { username: 'laizalves', name: 'Laiz Alves', ramal: 'realess-1978' },
    { username: 'larissa', name: 'LARISSA', ramal: 'realess-1947' },
    { username: 'laurianecastro', name: 'LAURIANE CASTRO', ramal: 'realess-1934' },
    { username: 'leticiacordeiro', name: 'LETICIA CORDEIRO', ramal: 'realess-1901' },
    { username: 'lidiane', name: 'LIDIANE', ramal: 'realess-1971' },
    { username: 'ludmiladomingues', name: 'Ludmila Domingues', ramal: 'realess-1955' },
    { username: 'mariagrabriela', name: 'Maria Gabriela', ramal: 'realess-1925' },
    { username: 'mariliaarins', name: 'MARILIA ARINS', ramal: 'realess-1941' },
    { username: 'pattriciamartins', name: 'Pattricia Martins', ramal: 'realess-1927' },
    { username: 'paolarocha', name: 'Paola Rocha', ramal: 'realess-1949' },
    { username: 'prissilasoares', name: 'PRISSILA SOARES', ramal: 'realess-1988' },
    { username: 'roberto', name: 'ROBERTO', ramal: 'realess-1908' },
    { username: 'sthefannysantos', name: 'Sthefanny Santos', ramal: 'realess-1968' },
    { username: 'talitasilva', name: 'TALITA SILVA', ramal: 'realess-1931' },
    { username: 'viniciuscorreia', name: 'Vinicius Correia', ramal: 'realess-1953' },
    { username: 'wedley', name: 'WEDLEY', ramal: 'realess-1951' },
    { username: 'nataliareinert', name: 'Natalia Reinert', ramal: 'realess-195' },
    { username: 'annabeatriz', name: 'ANNA BEATRIZ SANTANA NOGUEIRA DA SILVA', ramal: 'realess-1957' },
    { username: 'eduardareinert', name: 'Eduarda Reinert', ramal: 'realess-1972' },
    { username: 'alinesouza', name: 'Aline Souza', ramal: 'realess-197' },
    { username: 'thacianefreisle', name: 'Thaciane Freisle', ramal: 'realess-197' },
    { username: 'nicollesouza', name: 'Nicolle Souza', ramal: 'realess-197' },
    { username: 'mariaroseno', name: 'Maria Roseno', ramal: 'realess-197' },
    { username: 'vitoriacomercial', name: 'Vitoria Comercial', ramal: 'realess-1986' },
    { username: 'nilmara', name: 'Nilmara', ramal: 'realess-196' },
    { username: 'annarecep', name: 'Anna Recepção', ramal: 'realess-195' },
    { username: 'fabiely', name: 'Fabiely', ramal: 'realess-190' },
    { username: 'yasminrosa', name: 'Yasmin.Rosa', ramal: 'realess-190' },
    { username: 'janainajuttel', name: 'JANAINA.JUTTEL', ramal: 'realess-190' },
    { username: 'lucas', name: 'Lucas', ramal: 'realess-190' },
    { username: 'tailane', name: 'Tailane', ramal: 'realess-194' },
    { username: 'leandroti', name: 'Leandro TI', ramal: 'realess-196' },
    { username: 'gabrielesilva', name: 'Gabriele Silva', ramal: 'realess-195' },
    { username: 'denver', name: 'DENVER', ramal: 'realess-195' },
    { username: 'mariana', name: 'Mariana', ramal: 'realess-195' },
    { username: 'kamillycaetano', name: 'Kamilly Caetano', ramal: 'realess-1910' },
    { username: 'beatrizcaetano', name: 'Beatriz Caetano', ramal: 'realess-1911' },
    { username: 'nayumiamaral', name: 'Nayumi Amaral', ramal: 'realess-1912' },
    { username: 'leticiacattoni', name: 'Leticia Cattoni', ramal: 'realess-1918' },
    { username: 'helena', name: 'Helena', ramal: 'realess-1919' },
    { username: 'beatrizmartins', name: 'Beatriz Martins', ramal: 'realess-1924' },
    { username: 'nicolyfreitas', name: 'Nicoly Freitas', ramal: 'realess-1926' },
    { username: 'maiarafernandes', name: 'Maiara Fernandes', ramal: 'realess-1937' },
    { username: 'juliamello', name: 'Julia Mello', ramal: 'realess-1940' },
    { username: 'isabellymachado', name: 'Isabelly Machado', ramal: 'realess-1943' },
    { username: 'gisele', name: 'Gisele', ramal: 'realess-1946' },
    { username: 'alexsandro', name: 'Alexsandro', ramal: 'realess-1969' },
    { username: 'caioaguiar', name: 'Caio Aguiar', ramal: 'realess-1980' },
    { username: 'anafacioli', name: 'Ana Facioli', ramal: 'realess-1989' },
    { username: 'juliakrapp', name: 'Julia Krapp', ramal: 'realess-1990' },
    { username: 'emillyrodrigues', name: 'Emilly Rodrigues', ramal: 'realess-1959' },
    { username: 'eloyse', name: 'Eloyse', ramal: 'realess-1963' },
    { username: 'natalia', name: 'Natalia', ramal: 'realess-1961' },
    { username: 'julianavilas', name: 'Juliana Vilas', ramal: 'realess-191' },
    { username: 'vitoria', name: 'Vitoria', ramal: 'realess-191' },
    { username: 'beatriz', name: 'Beatriz', ramal: 'realess-191' },
    { username: 'heloisa', name: 'Heloisa', ramal: 'realess-1936' },
    { username: 'mariarocha', name: 'Maria Rocha', ramal: 'realess-1904' },
    { username: 'juliafaez', name: 'Julia Faez', ramal: 'realess-1966' },
    { username: 'mariamaximiano', name: 'Maria Maximiano', ramal: 'realess-1981' }
  ];


  for (const user of defaultUsers) {
    const isManager = ['vicenzzo', 'gestora2'].includes(user.username);
    if (isManager) {
      const existing = await db.get('SELECT * FROM users WHERE username = ?', [user.username]);
      if (!existing) {
        const salt = await bcrypt.genSalt(10);
        // Garantir que a senha mestre do vicenzzo seja Vp28063@ se criada do zero, senão a atualizada no banco se mantém
        const pass = user.username === 'vicenzzo' ? 'Vp28063@' : user.password;
        const hash = await bcrypt.hash(pass, salt);
        await db.run(
          'INSERT INTO users (username, password_hash, name, ramal) VALUES (?, ?, ?, ?)',
          [user.username, hash, user.name, user.ramal || '']
        );
        console.log(`Gestor criado: ${user.username} (Ramal: ${user.ramal})`);
      } else if (user.ramal && !existing.ramal) {
        await db.run('UPDATE users SET ramal = ? WHERE id = ?', [user.ramal, existing.id]);
        console.log(`Ramal atualizado para gestor: ${user.username} -> ${user.ramal}`);
      }
    } else {
      // Semeando na tabela de colaboradores
      const existing = await db.get('SELECT * FROM collaborators WHERE name = ?', [user.name]);
      const sector = nameToSector[user.name] || 'Senior';
      if (!existing) {
        await db.run(
          'INSERT INTO collaborators (name, ramal, sector) VALUES (?, ?, ?)',
          [user.name, user.ramal || '', sector]
        );
      } else {
        await db.run(
          'UPDATE collaborators SET sector = ? WHERE id = ? AND (sector IS NULL OR sector = "Junior" OR sector = "")',
          [sector, existing.id]
        );
      }
    }
  }

  // Se não houver aparelhos no banco, criar alguns iniciais para o MVP
  await db.run("UPDATE users SET role = 'MASTER', email = 'vicenzzo.mastronikolis@realess.com.br', is_readonly = 0, allow_all_tabs = 1, allow_edit_devices = 1, allow_manage_users = 1, allow_dashboard = 1 WHERE LOWER(username) = 'vicenzzo'");

  const devicesCount = await db.get('SELECT COUNT(*) as count FROM devices');
  if (devicesCount.count === 0) {
    await db.run("INSERT INTO devices (name, sector) VALUES ('Arthur', 'Junior')");
    await db.run("INSERT INTO devices (name, sector) VALUES ('RESERVA', 'Senior')");
    await db.run("INSERT INTO devices (name, sector) VALUES ('PA_FIXA_1', 'PA FIXA 1')");
    await db.run("INSERT INTO devices (name, sector) VALUES ('Pesquisa_01', 'Pesquisa')");
    console.log('Aparelhos iniciais inseridos para testes.');
  }

  // Reparo de consistência de dados
  await db.run("UPDATE numbers SET name = 'Djully' WHERE LOWER(name) = 'djenny' AND excluido_em IS NULL");
  await db.run("UPDATE numbers SET holder = 'Djully' WHERE LOWER(holder) = 'djenny' AND excluido_em IS NULL");

  // Reparo de permissões de governança: Maiara restrita estritamente a PA FIXA
  try {
    await db.run("UPDATE users SET allow_all_tabs = 0 WHERE LOWER(username) LIKE '%maiara%' OR LOWER(name) LIKE '%maiara%'");
    const maiaraUsers = await db.all("SELECT id FROM users WHERE LOWER(username) LIKE '%maiara%' OR LOWER(name) LIKE '%maiara%'");
    for (const u of maiaraUsers) {
      await db.run("DELETE FROM user_sector_permissions WHERE user_id = ?", [u.id]);
      await db.run("INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, 'PA FIXA 1', 1, 1)", [u.id]);
      await db.run("INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, 'PA FIXA 2', 1, 1)", [u.id]);
    }
  } catch (errMaiara) {
    console.error('[DB] Erro ao sanitizar permissões da Maiara:', errMaiara);
  }

  console.log('Banco de dados inicializado com sucesso.');
  
  // Backup inicial assíncrono no boot
  syncBackup().catch(err => console.error('[BACKUP] Erro no backup inicial:', err));

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Banco de dados não inicializado. Chame initDb() primeiro.');
  }
  return db;
}

async function syncBackup() {
  const destDir = 'K:\\BACKOFFICE\\Vicenzzo\\banco de dados';
  const destPath = path.join(destDir, 'database.sqlite');
  
  try {
    // 1. Garantir que a pasta de destino exista
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // 2. Fazer checkpoint do WAL para garantir integridade física das transações ativas
    if (db) {
      await db.run('PRAGMA wal_checkpoint(PASSIVE)');
    }
    
    // 3. Copiar o arquivo físico
    fs.copyFile(dbPath, destPath, (err) => {
      if (err) {
        console.error('[BACKUP] Erro ao copiar banco de dados para K:\\:', err);
      } else {
        // console.log('[BACKUP] Banco de dados copiado com sucesso para K:\\');
      }
    });
  } catch (err) {
    console.error('[BACKUP] Falha ao processar sincronização de backup:', err);
  }
}

module.exports = {
  initDb,
  getDb,
  syncBackup
};

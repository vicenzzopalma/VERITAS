const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const ExcelJS = require('exceljs');

const { initDb, getDb } = require('./database');
const CrmService = require('./services/CrmService');
const SocketService = require('./services/SocketService');
const idempotencyMiddleware = require('./middlewares/idempotency');
const { PolicyEngine } = require('./security/PolicyEngine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const PORT = process.env.PORT || 3000;

async function getAvailableSectorCatalog(role) {
  const fallback = ['Junior', 'Senior', 'PA FIXA 1', 'PA FIXA 2', 'Pesquisa', 'Juridico', 'Comercial'];
  try {
    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    const veritasDbPath = path.resolve(__dirname, '..', 'backend', 'whaticket.sqlite');
    if (!fs.existsSync(veritasDbPath)) return fallback;
    const db = await open({ filename: veritasDbPath, driver: sqlite3.Database });
    const rows = await db.all('SELECT name, minimumProfile FROM Sectors WHERE active = 1 ORDER BY name ASC');
    await db.close();
    if (!rows || rows.length === 0) return fallback;
    return rows.filter(row => role === 'admin_master' || row.minimumProfile !== 'admin_master').map(row => row.name);
  } catch (err) {
    return fallback;
  }
}

app.set('trust proxy', 1);

// Configurar o middleware de sessão com banco persistente para evitar vazamento de memória
let sessionStore;
const sessionParser = session({
  store: sessionStore = new SQLiteStore({ 
    db: 'sessions.sqlite', 
    dir: __dirname,
    concurrentDB: true // Vital para funcionar em paralelo ao SQLite transacional
  }),
  secret: 'chave-secreta-do-crm-de-celulares-realess',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using https
    maxAge: 24 * 60 * 60 * 1000 // 1 dia
  }
});

app.use(sessionParser);
app.use(express.json());
app.use(idempotencyMiddleware);

// Configurar CORS para permitir requisiÃ§Ãµes de origens de extensÃ£o
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-extension-token, x-veritas-token, ngrok-skip-browser-warning');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Função Centralizada para Resolver o Usuário do Veritas via Token SSO JWT
const ssoPermissionLocks = new Map();

async function resolveUserFromSsoToken(ssoToken) {
  if (!ssoToken) return null;
  try {
    const parts = String(ssoToken).split('.');
    if (parts.length < 2) return null;
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    const decoded = JSON.parse(payloadStr);
    if (!decoded) return null;

    const profile = (decoded.profile || 'user').toLowerCase().trim();
    const isWhatsappControl = profile === 'whatsapp_control' || profile === 'whatsapp_control_high';
    const normalizedEmail = (decoded.email || '').toLowerCase().trim();
    const isMasterAdmin = normalizedEmail === 'vicenzzo.mastronikolis@realess.com.br' && (profile === 'admin_master' || profile === 'admin');
    const isAdmin = ['admin', 'admin_master', 'admin_operational'].includes(profile) || normalizedEmail.startsWith('admin');

    let rawSectors = decoded.connectionSectors;
    if (typeof rawSectors === 'string') {
      try { rawSectors = JSON.parse(rawSectors); } catch (e) { rawSectors = [rawSectors]; }
    }
    let sectors = Array.isArray(rawSectors)
      ? rawSectors.map(String).map(s => s.trim()).filter(Boolean)
      : [];

    // Se for gestor e os setores não vierem no token, consultar o SQLite do Veritas
    if (sectors.length === 0 && isWhatsappControl) {
      try {
        const sqlite3 = require('sqlite3');
        const { open } = require('sqlite');
        const veritasDbPath = path.resolve(__dirname, '..', 'backend', 'whaticket.sqlite');
        if (fs.existsSync(veritasDbPath)) {
          const vDb = await open({ filename: veritasDbPath, driver: sqlite3.Database });
          const row = await vDb.get('SELECT connectionSectors FROM Users WHERE id = ? OR LOWER(email) = ?', [decoded.id, (decoded.email || '').toLowerCase()]);
          if (row && row.connectionSectors) {
            let parsed = row.connectionSectors;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch (e) { parsed = [parsed]; }
            }
            if (Array.isArray(parsed)) {
              sectors = parsed.map(String).map(s => s.trim()).filter(Boolean);
            }
          }
          await vDb.close();
        }
      } catch (errDb) {
        console.error('[SSO] Falha ao consultar setores no whaticket.sqlite:', errDb);
      }
    }

    // Se ainda assim não vierem setores no token/banco e for gestor, o padrão é PA FIXA
    if (sectors.length === 0 && isWhatsappControl) {
      sectors = ['PA FIXA 1', 'PA FIXA 2'];
    }

    // Normalizar qualquer menção de 'PA FIXA' genérica para ambos os subsetores 'PA FIXA 1' e 'PA FIXA 2'
    const expandedSectors = [];
    for (const s of sectors) {
      if (s === 'PA FIXA') {
        expandedSectors.push('PA FIXA 1', 'PA FIXA 2');
      } else {
        expandedSectors.push(s);
      }
    }
    sectors = [...new Set(expandedSectors)];

    const veritasUser = {
      id: decoded.id,
      name: (decoded.username || decoded.usarname || decoded.name || '').trim(),
      email: (decoded.email || '').toLowerCase().trim(),
      profile,
      canAccessConnections: true,
      connectionSectors: sectors
    };

    const db = getDb();
    if (!db) return null;

    const rawName = veritasUser.name;
    const email = veritasUser.email;
    const emailPrefix = email.includes('@') ? email.split('@')[0].trim() : email;
    const firstName = rawName.includes(' ') ? rawName.split(' ')[0].trim() : rawName;

    // 1. Tentar bater por emailPrefix ou rawName exato no CRM
    let targetUser = await db.get(
      'SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1',
      [email]
    );
    if (!targetUser) targetUser = await db.get(
      'SELECT * FROM users WHERE LOWER(username) = ? LIMIT 1',
      [emailPrefix.toLowerCase()]
    );
    if (!targetUser && rawName) {
      targetUser = await db.get(
        'SELECT * FROM users WHERE LOWER(name) = ? OR LOWER(username) = ? LIMIT 1',
        [rawName.toLowerCase(), rawName.toLowerCase()]
      );
    }

    // 2. Se não encontrou e tem primeiro nome, tentar primeiro nome
    if (!targetUser && firstName) {
      targetUser = await db.get(
        `SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(name) = ?`,
        [firstName.toLowerCase(), firstName.toLowerCase()]
      );
    }

    // 3. Se ainda não existe no CRM, cria o usuário para preservar a identidade individual
    const allowAllTabs = isAdmin ? 1 : 0;
    if (!targetUser && (rawName || emailPrefix)) {
      const newUsername = (emailPrefix || rawName.toLowerCase().replace(/\s+/g, '.')).slice(0, 30);
      const newName = rawName || emailPrefix;
      const defaultPasswordHash = await bcrypt.hash(Math.random().toString(36), 10);

      const insertRes = await db.run(
        `INSERT INTO users (username, email, role, password_hash, name, is_readonly, allow_all_tabs, allow_edit_devices, allow_manage_users, allow_dashboard, is_active, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))`,
        [newUsername, email, isMasterAdmin ? 'MASTER' : 'MANAGER', defaultPasswordHash, newName, 0, allowAllTabs, 1, isAdmin ? 1 : 0]
      );
      targetUser = await db.get('SELECT * FROM users WHERE id = ?', [insertRes.lastID]);
      console.log(`[SSO] Usuário sincronizado automaticamente do Veritas: ${newUsername} (${newName}) [allow_all_tabs=${allowAllTabs}]`);
    }

    if (targetUser) {
      const nextRole = isMasterAdmin ? 'MASTER' : (isAdmin && targetUser.role !== 'VIEWER' ? 'MANAGER' : (targetUser.role || 'MANAGER'));
      await db.run('UPDATE users SET email = ?, role = ? WHERE id = ?', [email, nextRole, targetUser.id]);
      targetUser.email = email;
      targetUser.role = nextRole;
    }

    if (targetUser && isWhatsappControl) {
      const lockKey = String(targetUser.id);
      const previousLock = ssoPermissionLocks.get(lockKey);
      let releaseLock;
      const currentLock = new Promise(resolve => {
        releaseLock = resolve;
      });
      ssoPermissionLocks.set(lockKey, currentLock);
      if (previousLock) await previousLock;

      try {
        let expectedSectors = [...new Set(veritasUser.connectionSectors)];
        const allKnownSectors = ['Junior', 'Senior', 'PA FIXA 1', 'PA FIXA 2', 'Pesquisa', 'Comercial', 'Juridico'];
        const isMaiara = (targetUser.username || '').toLowerCase().includes('maiara') || (targetUser.name || '').toLowerCase().includes('maiara');
        if (isMaiara) {
          expectedSectors = ['PA FIXA 1', 'PA FIXA 2'];
        }
        const hasAllSectors = expectedSectors.length >= 5 && ['Junior', 'Senior', 'PA FIXA 1', 'PA FIXA 2', 'Pesquisa'].every(s => expectedSectors.includes(s));
        const shouldAllowAll = !isMaiara && !isWhatsappControl && (isAdmin || hasAllSectors);
        await db.run('UPDATE users SET allow_all_tabs = ?, atualizado_em = datetime(\'now\') WHERE id = ?', [shouldAllowAll ? 1 : 0, targetUser.id]);
        
        await db.run('DELETE FROM user_sector_permissions WHERE user_id = ?', [targetUser.id]);
        for (const sector of expectedSectors) {
          await db.run(
            'INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, ?, 1, 1)',
            [targetUser.id, sector]
          );
        }
        targetUser.allow_all_tabs = shouldAllowAll ? 1 : 0;
        console.log(`[SSO] Setores do gestor ${targetUser.username} (${targetUser.name}) atualizados estritamente para:`, expectedSectors, `[allow_all_tabs=${targetUser.allow_all_tabs}]`);
        await refreshUserSessions(targetUser.id);
      } finally {
        releaseLock();
        if (ssoPermissionLocks.get(lockKey) === currentLock) {
          ssoPermissionLocks.delete(lockKey);
        }
      }
    }

    return targetUser;
  } catch (err) {
    console.error('[SSO] Falha ao resolver usuário do token:', err.message);
    return null;
  }
}

// Middleware de Autenticação SSO Seamless com VERITAS
app.use(async (req, res, next) => {
  let ssoToken = req.query.sso_token || req.headers['x-sso-token'] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!ssoToken && req.headers.referer && req.headers.referer.includes('sso_token=')) {
    try {
      const refUrl = new URL(req.headers.referer);
      ssoToken = refUrl.searchParams.get('sso_token');
    } catch (e) {}
  }

  if (ssoToken) {
    const targetUser = await resolveUserFromSsoToken(ssoToken);
    if (targetUser) {
      // Se a sessão atual for de outro usuário ou não existir, atualiza imediatamente
      if (!req.session.userId || req.session.userId !== targetUser.id) {
        req.session.userId = targetUser.id;
        req.session.username = targetUser.username;
        req.session.name = targetUser.name;
        req.session.userName = targetUser.name;
        req.session.isReadonly = targetUser.is_readonly === 1;
        req.session.allowEditDevices = PolicyEngine.canEditDevices(targetUser);
        req.session.allowManageUsers = PolicyEngine.canManageUsers(targetUser);
        req.session.allowDashboard = PolicyEngine.canViewDashboard(targetUser) ? 1 : 0;
        return req.session.save((err) => {
          if (err) console.error('[SSO] Erro ao salvar sessão:', err);
          next();
        });
      }
    }
  }

  next();
});

// Proteger rotas estáticas
app.use(async (req, res, next) => {
  // Se tentar acessar login.html dentro do Veritas ou já autenticado, redireciona para a raiz do CRM
  if (req.path === '/login.html') {
    return res.redirect('/');
  }

  const publicPaths = ['/login.html', '/login.js', '/style.css', '/popup.html', '/api/auth/login', '/html2pdf.bundle.min.js'];
  if (
    publicPaths.includes(req.path) || 
    req.path.startsWith('/api/auth/login') || 
    req.path.startsWith('/api/public/') ||
    req.path.startsWith('/api/integrations/veritas/')
  ) {
    return next();
  }
  
  if (!req.session.userId) {
    // Se veio do Veritas com sso_token no referer
    const referer = req.headers.referer || '';
    if (referer.includes('sso_token=')) {
      try {
        const refUrl = new URL(referer);
        const token = refUrl.searchParams.get('sso_token');
        if (token) {
          const target = await resolveUserFromSsoToken(token);
          if (target) {
            req.session.userId = target.id;
            req.session.username = target.username;
            req.session.name = target.name;
            req.session.userName = target.name;
            req.session.isReadonly = target.is_readonly === 1;
            req.session.allowEditDevices = target.allow_edit_devices === 1;
            req.session.allowManageUsers = target.allow_manage_users === 1;
            req.session.allowDashboard = PolicyEngine.canViewDashboard(target) ? 1 : 0;
            return req.session.save(() => next());
          }
        }
      } catch (e) {}
    }
  }
  
  next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Integrar Session Parser com WebSocket Upgrade
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const isAgent = url.pathname === '/agent' || url.searchParams.get('role') === 'agent' || request.headers['x-agent-token'];

  if (isAgent) {
    const token = url.searchParams.get('token') || request.headers['x-agent-token'];
    if (token === 'realess-agent-token') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.isAgent = true;
        wss.emit('connection', ws, request);
      });
      return;
    } else {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
  }

  sessionParser(request, {}, async () => {
    let ssoToken = url.searchParams.get('sso_token') || url.searchParams.get('token') || request.headers['x-sso-token'];
    if (!ssoToken && request.headers.referer && request.headers.referer.includes('sso_token=')) {
      try {
        const refUrl = new URL(request.headers.referer);
        ssoToken = refUrl.searchParams.get('sso_token');
      } catch (e) {}
    }

    if (ssoToken) {
      const targetUser = await resolveUserFromSsoToken(ssoToken);
      if (targetUser) {
        request.session = request.session || {};
        request.session.userId = targetUser.id;
        request.session.username = targetUser.username;
        request.session.name = targetUser.name;
        request.session.userName = targetUser.name;
        request.session.isReadonly = targetUser.is_readonly === 1;
        request.session.allowEditDevices = PolicyEngine.canEditDevices(targetUser);
        request.session.allowManageUsers = PolicyEngine.canManageUsers(targetUser);
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

// Busca o usuÃ¡rio no banco em tempo real para validar permissÃµes.
// A sessÃ£o pode estar desatualizada (ex.: nÃ­vel alterado depois do login),
// entÃ£o a autorizaÃ§Ã£o SEMPRE reflete o estado atual do banco de dados.
async function buildSessionUserFromDb(req) {
  const dbUser = await crmService.userRepo.getById(req.session.userId);
  if (!dbUser) return null;
  const sectorPermissions = await crmService.userRepo.getSectorPermissions(dbUser.id);

  req.session.isReadonly = !!dbUser.is_readonly;
  req.session.allowEditDevices = !!dbUser.allow_edit_devices;
  req.session.allowManageUsers = !!dbUser.allow_manage_users;
  req.session.allowDashboard = !!dbUser.allow_dashboard;

  return {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    role: dbUser.role,
    allow_all_tabs: dbUser.allow_all_tabs,
    is_readonly: dbUser.is_readonly,
    allow_edit_devices: dbUser.allow_edit_devices,
    allow_manage_users: dbUser.allow_manage_users,
    allow_dashboard: dbUser.allow_dashboard,
    is_active: dbUser.is_active,
    sectorPermissions
  };
}

function getPermittedCollaboratorSectors(user) {
  if (!user) return [];
  if (PolicyEngine.determineRole(user) === 'MASTER' || user.allow_all_tabs === 1 || user.allow_all_tabs === true) {
    return null;
  }
  return (user.sectorPermissions || [])
    .filter(permission => permission.can_view === 1)
    .map(permission => permission.sector);
}

function canAccessCollaboratorSector(user, sector) {
  const permittedSectors = getPermittedCollaboratorSectors(user);
  return permittedSectors === null || permittedSectors.includes(String(sector || '').trim());
}

// Sincroniza as sessÃµes persistidas de um usuÃ¡rio com as permissÃµes atuais do banco.
// Corrige o problema de "sessÃ£o congelada": quando o nÃ­vel/permissÃµes de um gestor
// mudam, qualquer sessÃ£o antiga (prÃ©-mudanÃ§a) Ã© atualizada para os flags corretos,
// evitando que o usuÃ¡rio continue preso como "apenas visualizador" (ou com permissÃµes
// antigas) mesmo sem refazer login.
async function refreshUserSessions(userId) {
  try {
    const dbUser = await crmService.userRepo.getById(userId);
    if (!dbUser) return;

    const freshFlags = {
      isReadonly: !!dbUser.is_readonly,
      allowEditDevices: !!dbUser.allow_edit_devices,
      allowManageUsers: !!dbUser.allow_manage_users,
      allowDashboard: !!dbUser.allow_dashboard
    };

    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    const sessionsDb = await open({
      filename: path.join(__dirname, 'sessions.sqlite'),
      driver: sqlite3.Database
    });

    try {
      const rows = await sessionsDb.all('SELECT sid, sess FROM sessions');
      let updatedCount = 0;
      for (const row of rows || []) {
        if (!row.sess || !row.sess.includes(`"userId":${userId}`)) continue;
        try {
          const sess = JSON.parse(row.sess);
          if (sess.userId !== userId) continue;
          sess.isReadonly = freshFlags.isReadonly;
          sess.allowEditDevices = freshFlags.allowEditDevices;
          sess.allowManageUsers = freshFlags.allowManageUsers;
          sess.allowDashboard = freshFlags.allowDashboard;
          await sessionsDb.run('UPDATE sessions SET sess = ? WHERE sid = ?', [JSON.stringify(sess), row.sid]);
          updatedCount++;
        } catch (parseErr) {
          console.error('Erro ao interpretar sessÃ£o durante sync:', parseErr);
        }
      }
      if (updatedCount > 0) {
        console.log(`SessÃµes do usuÃ¡rio ${userId} sincronizadas com o banco (${updatedCount} sessÃ£o(Ãµes)).`);
      }
    } finally {
      await sessionsDb.close();
    }
  } catch (err) {
    console.error('Erro ao sincronizar sessÃµes do usuÃ¡rio:', err);
  }
}

// Novo Middleware: Permite acesso apenas a Gestores e Masters (Bloqueia Viewers)
async function requireManagerAccess(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'NÃ£o autenticado' });

  const sessionUser = await buildSessionUserFromDb(req);
  if (!sessionUser) return res.status(401).json({ error: 'NÃ£o autenticado' });

  if (!PolicyEngine.canWrite(sessionUser)) {
    return res.status(403).json({ error: 'Acesso restrito. VocÃª possui apenas permissÃ£o de visualizaÃ§Ã£o ou nÃ£o pode editar celulares.' });
  }
  next();
}

// Novo Middleware: Permite acesso a Masters e Gestores com a permissÃ£o de gerenciar usuÃ¡rios
async function requireMasterAccess(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'NÃ£o autenticado' });

  const sessionUser = await buildSessionUserFromDb(req);
  if (!sessionUser) return res.status(401).json({ error: 'NÃ£o autenticado' });

  if (!PolicyEngine.canManageUsers(sessionUser)) {
    return res.status(403).json({ error: 'Acesso negado. Apenas o administrador mestre ou gestores autorizados podem realizar esta aÃ§Ã£o.' });
  }
  next();
}

async function requireSectorAdminAccess(req, res, next) {
  const sessionUser = await buildSessionUserFromDb(req);
  if (!sessionUser || !PolicyEngine.canConfigureSectorPermissions(sessionUser)) {
    return res.status(403).json({ error: 'Apenas o Administrador Master pode configurar setores.' });
  }
  req.sessionUser = sessionUser;
  return next();
}

// Inicializar serviÃ§os globais apÃ³s a conexÃ£o do banco
let crmService;
let socketService;

async function generateStyledXlsx(columns, rows, sheetName) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CRM Celulares';
  const ws = workbook.addWorksheet(sheetName);

  ws.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width || 20
  }));

  ws.addRows(rows);

  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF34495E' } },
      bottom: { style: 'thin', color: { argb: 'FF34495E' } },
      left: { style: 'thin', color: { argb: 'FF34495E' } },
      right: { style: 'thin', color: { argb: 'FF34495E' } }
    };
  });

  ws.eachRow((row, rowIndex) => {
    if (rowIndex === 1) return;
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF2C3E50' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBDC3C7' } },
        bottom: { style: 'thin', color: { argb: 'FFBDC3C7' } },
        left: { style: 'thin', color: { argb: 'FFBDC3C7' } },
        right: { style: 'thin', color: { argb: 'FFBDC3C7' } }
      };
    });
    if (rowIndex % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F6FA' } };
      });
    }
  });

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: columns.length }
  };

  return workbook;
}

function parseBanAction(action, defaultUser) {
  let tipoAcao = 'Outro';
  let chip = 'â€”';
  let inicio = 'â€”';
  let termino = 'â€”';
  let aplicadoPor = defaultUser || 'â€”';

  if (!action) {
    return { tipoAcao, chip, inicio, termino, aplicadoPor };
  }

  // 1a. Restringiu ou Ajustou chip "nome" (status) - Inicio: data - Termino: data (Aplicado por: usuario)
  if (action.includes('Restringiu chip') || action.includes('Ajustou tempo do chip')) {
    const regex = /(?:Restringiu|Ajustou tempo do) chip "([^"]+)" \(([^)]+)\) - Inicio:\s*([^-]+)\s*-\s*Termino:\s*([^(\n]+)(?:\s*\(Aplicado por:\s*([^)]+)\))?/i;
    const match = action.match(regex);
    if (match) {
      chip = match[1];
      tipoAcao = match[2]; // ex: "Restrito 24 horas"
      inicio = match[3].trim();
      
      let termVal = match[4].trim();
      const matchApp = termVal.match(/(.*?)(?:\s*\(Aplicado por:\s*([^)]+)\))?$/i);
      if (matchApp) {
        termino = matchApp[1].trim();
        if (matchApp[2]) {
          aplicadoPor = matchApp[2].trim();
        } else if (match[5]) {
          aplicadoPor = match[5].trim();
        }
      } else {
        termino = termVal;
        if (match[5]) {
          aplicadoPor = match[5].trim();
        }
      }
      return { tipoAcao, chip, inicio, termino, aplicadoPor };
    }
  }

  // 1b. Baniu chip "nome" - Inicio: data - Termino: data (Aplicado por: usuario)
  if (action.includes('Baniu chip')) {
    const regex = /Baniu chip "([^"]+)" - Inicio:\s*([^-]+)\s*-\s*Termino:\s*([^(\n]+)(?:\s*\(Aplicado por:\s*([^)]+)\))?/i;
    const match = action.match(regex);
    if (match) {
      chip = match[1];
      tipoAcao = 'Banido';
      inicio = match[2].trim();
      
      let termVal = match[3].trim();
      const matchApp = termVal.match(/(.*?)(?:\s*\(Aplicado por:\s*([^)]+)\))?$/i);
      if (matchApp) {
        termino = matchApp[1].trim();
        if (matchApp[2]) {
          aplicadoPor = matchApp[2].trim();
        } else if (match[4]) {
          aplicadoPor = match[4].trim();
        }
      } else {
        termino = termVal;
        if (match[4]) {
          aplicadoPor = match[4].trim();
        }
      }
      return { tipoAcao, chip, inicio, termino, aplicadoPor };
    }
  }

  // 1c. Banido definitivamente: chip "nome" - Inicio: data
  if (action.includes('Banido definitivamente')) {
    const regex = /Banido definitivamente:\s*chip\s*"([^"]+)"\s*- Inicio:\s*([^(\n]+)(?:\s*\(Aplicado por:\s*([^)]+)\))?/i;
    const match = action.match(regex);
    if (match) {
      chip = match[1];
      tipoAcao = 'Banido Definitivo';
      inicio = match[2].trim();
      if (match[3]) {
        aplicadoPor = match[3].trim();
      }
      return { tipoAcao, chip, inicio, termino: '', aplicadoPor };
    }
  }

  // 2. Alterou status do chip "..." para ...
  if (action.includes('Alterou status do chip')) {
    const regex = /Alterou status do chip "([^"]+)" para ([^(\n]+)(?:\s*\(Aplicado por:\s*([^)]+)\))?/i;
    const match = action.match(regex);
    if (match) {
      chip = match[1];
      let statusVal = match[2].trim();
      const matchApp = statusVal.match(/(.*?)(?:\s*\(Aplicado por:\s*([^)]+)\))?$/i);
      if (matchApp) {
        tipoAcao = matchApp[1].trim();
        if (matchApp[2]) {
          aplicadoPor = matchApp[2].trim();
        } else if (match[3]) {
          aplicadoPor = match[3].trim();
        }
      } else {
        tipoAcao = statusVal;
        if (match[3]) {
          aplicadoPor = match[3].trim();
        }
      }
      return { tipoAcao, chip, inicio, termino, aplicadoPor };
    }
  }

  // 3. Confirmou liberaÃ§Ã£o
  if (action.includes('Confirmou liberacao') || action.includes('Confirmou liberaÃ§Ã£o')) {
    const regex = /Confirmou liberacao do chip "([^"]+)"/i;
    const match = action.match(regex);
    if (match) {
      chip = match[1];
      tipoAcao = 'Confirmou LiberaÃ§Ã£o';
      return { tipoAcao, chip, inicio, termino, aplicadoPor };
    }
  }

  // 4. RestriÃ§Ã£o expirada
  if (action.includes('Restricao expirada') || action.includes('RestriÃ§Ã£o expirada')) {
    const regex = /Restricao expirada do chip "([^"]+)"/i;
    const match = action.match(regex);
    if (match) {
      chip = match[1];
      tipoAcao = 'RestriÃ§Ã£o Expirada';
      aplicadoPor = 'Sistema';
      return { tipoAcao, chip, inicio, termino, aplicadoPor };
    }
  }

  // Fallbacks gerais
  const matchQuotes = action.match(/"([^"]+)"/);
  if (matchQuotes) {
    chip = matchQuotes[1];
  }

  const matchApplied = action.match(/\(Aplicado por:\s*([^)]+)\)/i);
  if (matchApplied) {
    aplicadoPor = matchApplied[1].trim();
  }

  if (action.toLowerCase().includes('banido') || action.toLowerCase().includes('banimento')) {
    tipoAcao = 'Banido';
  } else if (action.toLowerCase().includes('restringiu') || action.toLowerCase().includes('restrito')) {
    tipoAcao = 'Restrito';
  } else if (action.toLowerCase().includes('liberacao') || action.toLowerCase().includes('liberaÃ§Ã£o') || action.toLowerCase().includes('confirmou')) {
    tipoAcao = 'LiberaÃ§Ã£o';
  } else if (action.toLowerCase().includes('expirada')) {
    tipoAcao = 'Expirada';
  }

  return { tipoAcao, chip, inicio, termino, aplicadoPor };
}

// --- ROTAS HTTP API ---

// --- INTEGRAÇÃO VERITAS (WHATICKET) PUSH REVERSO ---
const VERITAS_SYNC_SECRET = process.env.VERITAS_SYNC_TOKEN || 'esfera_veritas_sync_secret_2026';

function requireVeritasToken(req, res, next) {
  const token = req.headers['x-veritas-token'] || 
                (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : null) ||
                req.query.token;

  if (!token || token !== VERITAS_SYNC_SECRET) {
    return res.status(401).json({
      type: 'https://esfera.com/errors/unauthorized',
      title: 'Não Autorizado',
      status: 401,
      detail: 'Token de sincronização do VERITAS ausente ou inválido.'
    });
  }
  next();
}

app.post('/api/integrations/veritas/heartbeat', requireVeritasToken, async (req, res) => {
  try {
    const { instances } = req.body;
    if (!instances || !Array.isArray(instances)) {
      return res.status(400).json({
        type: 'https://esfera.com/errors/bad-request',
        title: 'Formato Inválido',
        status: 400,
        detail: 'O corpo da requisição deve conter a propriedade "instances" como um array de conexões.'
      });
    }

    const result = await crmService.syncVeritasHeartbeat(instances);

    if (result.updatedNumbers && result.updatedNumbers.length > 0 && socketService) {
      socketService.broadcastVeritasStatusUpdate(result.updatedNumbers);
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      updatedCount: result.updatedCount,
      updatedNumbers: result.updatedNumbers
    });
  } catch (err) {
    console.error('Erro na rota de heartbeat do VERITAS:', err);
    return res.status(500).json({ error: 'Erro interno ao processar sincronização do VERITAS' });
  }
});

app.get('/api/integrations/veritas/status', async (req, res) => {
  try {
    const summary = await crmService.getVeritasSummary();
    return res.json({ success: true, ...summary });
  } catch (err) {
    console.error('Erro ao consultar status do VERITAS:', err);
    return res.status(500).json({ error: 'Erro interno ao consultar status do VERITAS' });
  }
});

// Rota pública para outros apps (como o modal do VERITAS) consultarem os chips por setor
app.get('/api/public/chips', async (req, res) => {
  try {
    const { sector } = req.query;
    const [devices, numbers] = await Promise.all([
      crmService.deviceRepo.getAll(),
      crmService.numberRepo.getAll()
    ]);

    const deviceMap = new Map();
    devices.forEach(d => deviceMap.set(d.id, d));

    let chips = numbers.map(n => {
      const dev = deviceMap.get(n.device_id);
      return {
        id: n.id,
        name: n.name,
        phone_number: n.phone_number,
        status: n.status,
        holder: n.holder,
        device_id: n.device_id,
        device_name: dev ? dev.name : '',
        sector: dev ? dev.sector : '',
        restricted_until: n.restricted_until,
        restricted_at: n.restricted_at,
        alarm_active: n.alarm_active
      };
    });

    if (sector && String(sector).trim()) {
      const targetSec = String(sector).trim().toLowerCase();
      chips = chips.filter(c => c.sector && c.sector.toLowerCase() === targetSec);
    }

    return res.json({ success: true, count: chips.length, chips });
  } catch (err) {
    console.error('Erro ao listar chips públicos:', err);
    return res.status(500).json({ error: 'Erro interno ao listar chips' });
  }
});

// APIs de Autenticação
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'UsuÃ¡rio e senha sÃ£o obrigatÃ³rios' });
  }

  try {
    const user = await crmService.userRepo.getByUsername(username.trim().toLowerCase());

    if (!user) {
      return res.status(400).json({ error: 'UsuÃ¡rio ou senha incorretos' });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ error: 'Sua conta estÃ¡ desativada. Entre em contato com o administrador.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'UsuÃ¡rio ou senha incorretos' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userName = user.name;
    req.session.isReadonly = !!user.is_readonly;
    req.session.allowEditDevices = !!user.allow_edit_devices;
    req.session.allowManageUsers = !!user.allow_manage_users;
    req.session.allowDashboard = PolicyEngine.canViewDashboard(user) ? 1 : 0;

    return res.json({ 
      success: true, 
      user: { 
        username: user.username, 
        name: user.name, 
        isReadonly: !!user.is_readonly,
        allowEditDevices: !!user.allow_edit_devices,
        allowManageUsers: !!user.allow_manage_users,
        allowDashboard: PolicyEngine.canViewDashboard(user) ? 1 : 0
      } 
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao deslogar' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

app.get('/api/auth/me', async (req, res) => {
  let ssoToken = req.query.sso_token || req.headers['x-sso-token'] || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!ssoToken && req.headers.referer && req.headers.referer.includes('sso_token=')) {
    try {
      const refUrl = new URL(req.headers.referer);
      ssoToken = refUrl.searchParams.get('sso_token');
    } catch (e) {}
  }

  if (ssoToken) {
    const ssoUser = await resolveUserFromSsoToken(ssoToken);
    if (ssoUser) {
      req.session.userId = ssoUser.id;
      req.session.username = ssoUser.username;
      req.session.name = ssoUser.name;
      req.session.userName = ssoUser.name;
      req.session.isReadonly = ssoUser.is_readonly === 1;
      req.session.allowEditDevices = PolicyEngine.canEditDevices(ssoUser);
      req.session.allowManageUsers = PolicyEngine.canManageUsers(ssoUser);
      req.session.allowDashboard = PolicyEngine.canViewDashboard(ssoUser) ? 1 : 0;
    }
  }

  let userId = req.session.userId;
  if (userId) {
    try {
      const user = await crmService.userRepo.getById(userId);
      if (user) {
        let perms = await crmService.userRepo.getSectorPermissions(userId);
        const uName = (user.username || '').toLowerCase();
        const dName = (user.name || '').toLowerCase();
        const isMaiara = uName.includes('maiara') || dName.includes('maiara');
        if (isMaiara) {
          user.allow_all_tabs = 0;
          perms = [
            { sector: 'PA FIXA 1', can_view: 1, can_configure: 1 },
            { sector: 'PA FIXA 2', can_view: 1, can_configure: 1 }
          ];
        }
        return res.json({ 
          loggedIn: true, 
          user: { 
            id: userId,
            username: user.username, 
            email: user.email,
            role: user.role,
            name: user.name, 
            allowAllTabs: isMaiara ? 0 : user.allow_all_tabs,
            isReadonly: user.is_readonly,
            ramal: user.ramal,
            allowEditDevices: !!user.allow_edit_devices,
            allowManageUsers: !!user.allow_manage_users,
            allowDashboard: PolicyEngine.canViewDashboard(user) ? 1 : 0,
            sectorPermissions: perms,
            availableSectors: await getAvailableSectorCatalog(user.role)
          } 
        });
      }
    } catch (err) {
      console.error('Erro ao obter dados de sessão:', err);
    }
  }
  return res.json({ loggedIn: false });
});

// APIs de ExportaÃ§Ã£o de Dados
app.get('/api/export/logs', async (req, res) => {
  try {
    const type = req.query.type;
    const todayOnly = req.query.today === 'true';
    const sectorFilter = req.query.sector;
    const managerFilter = req.query.manager;
    
    // Obter logs dos repositÃ³rios correspondentes
    const logs = await crmService.auditRepo.getAll();
    const reservationLogs = await crmService.reservationRepo.getAll();
    
    // Obter aparelhos e números para correspondência precisa de setores
    const db = getDb();
    const devices = await db.all("SELECT id, name, sector FROM devices");
    const numbers = await db.all("SELECT n.phone_number, d.sector FROM numbers n JOIN devices d ON n.device_id = d.id");
    
    const getLogSector = (log) => {
      const h = (log.holder || '').toUpperCase().trim();
      const act = (log.action || '').toUpperCase();
      if (h === 'WEDLEY' || h.includes('WEDLEY') || act.includes('"WEDLEY"')) {
        return 'Senior';
      }
      if (log.sector) return log.sector;
      if (log.phone_number && log.phone_number !== '-') {
        const clean = String(log.phone_number).replace(/\D/g, '');
        const match = numbers.find(n => String(n.phone_number || '').replace(/\D/g, '') === clean);
        if (match) return match.sector;
      }
      if (log.device_name && log.device_name !== '-') {
        const matchingDevs = devices.filter(d => d.name.toLowerCase() === log.device_name.toLowerCase());
        if (matchingDevs.length === 1) return matchingDevs[0].sector;
      }
      return null;
    };

    let filename = 'historico_auditoria.xlsx';
    let columns, rows;
    let sheetName = 'Histórico';

    if (type === 'reservations') {
      filename = 'historico_uso_reservas.xlsx';
      sheetName = 'Uso de Reservas';
      columns = [
        { header: 'Data/Hora', key: 'data', width: 22 },
        { header: 'Gestor', key: 'gestor', width: 18 },
        { header: 'Setor', key: 'setor', width: 14 },
        { header: 'Aparelho', key: 'aparelho', width: 18 },
        { header: 'Número', key: 'numero', width: 18 },
        { header: 'Chip', key: 'chip', width: 22 },
        { header: 'Entregue para', key: 'entregue', width: 25 }
      ];

      let filteredReservations = reservationLogs;
      if (todayOnly) {
        const todayStr = new Date().toLocaleDateString('en-CA');
        filteredReservations = reservationLogs.filter(log => {
          return new Date(log.timestamp).toLocaleDateString('en-CA') === todayStr;
        });
        filename = 'historico_uso_reservas_hoje.xlsx';
      }

      // Filtrar por setor
      if (sectorFilter && sectorFilter !== 'all') {
        filteredReservations = filteredReservations.filter(log => getLogSector(log) === sectorFilter);
      }

      // Filtrar por gestor
      if (managerFilter && managerFilter !== 'all') {
        filteredReservations = filteredReservations.filter(log => log.assigned_by && log.assigned_by.trim().toLowerCase() === managerFilter.trim().toLowerCase());
      }

      rows = filteredReservations.map(log => ({
        data: new Date(log.timestamp).toLocaleString('pt-BR'),
        gestor: log.assigned_by,
        setor: getLogSector(log) || '—',
        aparelho: log.device_name,
        numero: log.phone_number,
        chip: log.chip_name,
        entregue: log.user_assigned
      }));
    } else {
      let filteredLogs = logs;
      if (type === 'bans') {
        filteredLogs = logs.filter(log => log.action.includes('Banido') || log.action.includes('Restrito') || log.action.includes('liberação') || log.action.includes('expirada'));
        filename = 'historico_banimentos_restricoes.xlsx';
        sheetName = 'Banimentos e Restrições';
      } else if (type === 'general') {
        filteredLogs = logs.filter(log => !(log.action.includes('Banido') || log.action.includes('Restrito') || log.action.includes('liberação') || log.action.includes('expirada')));
        filename = 'historico_alteracoes_gerais.xlsx';
        sheetName = 'Alterações Gerais';
      }

      if (todayOnly) {
        const todayStr = new Date().toLocaleDateString('en-CA');
        filteredLogs = filteredLogs.filter(log => {
          return new Date(log.timestamp).toLocaleDateString('en-CA') === todayStr;
        });
        if (type === 'bans') {
          filename = 'historico_banimentos_restricoes_hoje.xlsx';
        } else if (type === 'general') {
          filename = 'historico_alteracoes_gerais_hoje.xlsx';
        } else {
          filename = 'historico_auditoria_hoje.xlsx';
        }
      }

      // Filtrar por setor
      if (sectorFilter && sectorFilter !== 'all') {
        filteredLogs = filteredLogs.filter(log => getLogSector(log) === sectorFilter);
      }

      // Filtrar por gestor
      if (managerFilter && managerFilter !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.user_name && log.user_name.trim().toLowerCase() === managerFilter.trim().toLowerCase());
      }

      if (type === 'bans') {
        columns = [
          { header: 'ID', key: 'id', width: 6 },
          { header: 'Data/Hora', key: 'data', width: 22 },
          { header: 'Gestor Log', key: 'gestor', width: 20 },
          { header: 'Setor', key: 'setor', width: 14 },
          { header: 'Aparelho', key: 'aparelho', width: 18 },
          { header: 'Número', key: 'numero', width: 18 },
          { header: 'Responsável', key: 'responsavel', width: 22 },
          { header: 'Ação Realizada', key: 'acao_realizada', width: 25 },
          { header: 'Chip', key: 'chip', width: 20 },
          { header: 'Início', key: 'inicio', width: 22 },
          { header: 'Término', key: 'termino', width: 22 },
          { header: 'Aplicado Por', key: 'aplicado_por', width: 20 }
        ];
        rows = filteredLogs.map(log => {
          const parsed = parseBanAction(log.action, log.user_name);
          return {
            id: log.id,
            data: new Date(log.timestamp).toLocaleString('pt-BR'),
            gestor: log.user_name,
            setor: getLogSector(log) || '—',
            aparelho: log.device_name,
            numero: log.phone_number,
            responsavel: log.holder || '—',
            acao_realizada: parsed.tipoAcao,
            chip: parsed.chip,
            inicio: parsed.inicio,
            termino: parsed.termino,
            aplicado_por: parsed.aplicadoPor
          };
        });
      } else {
        columns = [
          { header: 'ID', key: 'id', width: 6 },
          { header: 'Data/Hora', key: 'data', width: 22 },
          { header: 'Gestor', key: 'gestor', width: 20 },
          { header: 'Setor', key: 'setor', width: 14 },
          { header: 'Aparelho', key: 'aparelho', width: 18 },
          { header: 'Número', key: 'numero', width: 18 },
          { header: 'Responsável', key: 'responsavel', width: 22 },
          { header: 'Ação Realizada', key: 'acao', width: 60 }
        ];
        rows = filteredLogs.map(log => ({
          id: log.id,
          data: new Date(log.timestamp).toLocaleString('pt-BR'),
          gestor: log.user_name,
          setor: getLogSector(log) || '—',
          aparelho: log.device_name,
          numero: log.phone_number,
          responsavel: log.holder || '—',
          acao: log.action
        }));
      }
    }

    const workbook = await generateStyledXlsx(columns, rows, sheetName);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erro ao exportar logs:', err);
    return res.status(500).send('Erro interno ao exportar');
  }
});

app.get('/api/export/inventory', async (req, res) => {
  try {
    const db = getDb();
    // Consulta SQL explicitando todas as colunas necessÃ¡rias da junÃ§Ã£o (em conformidade com a governanÃ§a)
    const data = await db.all(`
      SELECT d.id as device_id, d.name as device_name, d.sector, n.phone_number, n.name as number_name, n.status, n.restricted_until, n.alarm_active, n.holder
      FROM devices d
      LEFT JOIN numbers n ON d.id = n.device_id
      ORDER BY d.sector, d.name
    `);

    const columns = [
      { header: 'Setor', key: 'setor', width: 16 },
      { header: 'Aparelho', key: 'aparelho', width: 18 },
      { header: 'Identificador do Chip', key: 'chip', width: 28 },
      { header: 'NÃºmero', key: 'numero', width: 18 },
      { header: 'ResponsÃ¡vel', key: 'responsavel', width: 25 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Restrito AtÃ©', key: 'restrito', width: 22 },
      { header: 'Alarme Ativo', key: 'alarme', width: 14 }
    ];

    const rows = data.map(row => ({
      setor: row.sector,
      aparelho: row.device_name,
      chip: row.number_name || '',
      numero: row.phone_number || '',
      responsavel: row.holder || '',
      status: row.status || '',
      restrito: row.restricted_until ? new Date(row.restricted_until).toLocaleString('pt-BR') : '',
      alarme: row.alarm_active ? 'Sim' : 'NÃ£o'
    }));

    const workbook = await generateStyledXlsx(columns, rows, 'InventÃ¡rio');
    const filename = 'inventario_aparelhos.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erro ao exportar inventÃ¡rio:', err);
    return res.status(500).send('Erro interno ao exportar');
  }
});

// Middleware para validar token da extensÃ£o (seguranÃ§a bÃ¡sica)
const validateExtensionToken = (req, res, next) => {
  const token = req.query.token || req.headers['x-extension-token'];
  const EXTENSION_SECRET = "esfera-extension-alarm-token-2026";
  if (token !== EXTENSION_SECRET) {
    return res.status(403).json({ error: 'Acesso negado: token invÃ¡lido' });
  }
  next();
};

// Obter alarmes ativos para a extensÃ£o
app.get('/api/public/alarms', validateExtensionToken, async (req, res) => {
  try {
    const db = require('./database').getDb();
    const query = `
      SELECT n.id, n.phone_number, n.name, n.holder, n.versao, d.name as device_name
      FROM numbers n
      JOIN devices d ON n.device_id = d.id
      WHERE n.alarm_active = 1 AND n.excluido_em IS NULL AND d.excluido_em IS NULL
    `;
    const rows = await db.all(query);
    const alarms = rows.map(r => ({
      id: r.id,
      phone: r.phone_number,
      name: r.name,
      deviceName: r.device_name,
      holder: r.holder || "",
      versao: r.versao
    }));
    return res.json({ alarms });
  } catch (err) {
    console.error('Erro ao buscar alarmes pÃºblicos:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});

// Liberar alarme via extensÃ£o
app.post('/api/public/alarms/release', validateExtensionToken, async (req, res) => {
  try {
    const { numberId, versao } = req.body;
    if (!numberId || versao === undefined) {
      return res.status(400).json({ error: 'ParÃ¢metros invÃ¡lidos' });
    }
    
    const systemUser = { name: 'ExtensÃ£o Chrome', username: 'extensao' };
    const result = await crmService.confirmRelease(numberId, versao, systemUser);
    
    // Propagar via WS e logs
    const updatedNum = await crmService.numberRepo.getById(numberId);
    const dev = await crmService.deviceRepo.getById(updatedNum.device_id);
    const sector = dev ? dev.sector : 'Junior';
    
    await socketService.broadcastDelta('NUMBER_UPDATED', updatedNum, sector);
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao liberar alarme via extensÃ£o:', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

app.get('/api/dashboard/stats', requireManagerAccess, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const sector = req.query.sector || 'all';
    const period = req.query.period || 'all';
    const stats = await crmService.getDashboardStats(sector, period);
    return res.json(stats);
  } catch (err) {
    console.error('Erro ao buscar estatísticas do dashboard:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/users/list', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'NÃ£o autenticado' });
  }
  try {
    const sessionUser = await buildSessionUserFromDb(req);
    const list = await crmService.collaboratorRepo.getAll();
    const permittedSectors = getPermittedCollaboratorSectors(sessionUser);
    return res.json(
      permittedSectors === null
        ? list
        : list.filter(collaborator => permittedSectors.includes(collaborator.sector))
    );
  } catch (err) {
    console.error('Erro ao listar nomes de colaboradores para dropdown:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// APIs de Gerenciamento de Colaboradores (Exclusivo para Gestores)
app.get('/api/collaborators', requireManagerAccess, async (req, res) => {
  try {
    const sessionUser = await buildSessionUserFromDb(req);
    const list = await crmService.collaboratorRepo.getAll();
    const permittedSectors = getPermittedCollaboratorSectors(sessionUser);
    return res.json(
      permittedSectors === null
        ? list
        : list.filter(collaborator => permittedSectors.includes(collaborator.sector))
    );
  } catch (err) {
    console.error('Erro ao listar colaboradores:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/collaborators', requireManagerAccess, async (req, res) => {
  const { name, ramal, sector } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Nome Ã© obrigatÃ³rio' });
  }
  if (!sector || !sector.trim()) {
    return res.status(400).json({ error: "O campo Setor Ã© obrigatÃ³rio e configurÃ¡vel." });
  }
  try {
    const sessionUser = await buildSessionUserFromDb(req);
    if (!canAccessCollaboratorSector(sessionUser, sector)) {
      return res.status(403).json({ error: 'VocÃª nÃ£o possui permissÃ£o para este setor.' });
    }
    const currentUser = req.session.userName || 'Dev';
    const result = await crmService.addCollaborator({ name, ramal, sector }, currentUser);
    await socketService.broadcastDelta('COLLABORATOR_ADDED', result.collaborator);
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao cadastrar colaborador:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.put('/api/collaborators/:id', requireManagerAccess, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, ramal, sector } = req.body;
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invÃ¡lido' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome Ã© obrigatÃ³rio' });
  }
  if (!sector || !sector.trim()) {
    return res.status(400).json({ error: "O campo Setor Ã© obrigatÃ³rio e configurÃ¡vel." });
  }
  try {
    const sessionUser = await buildSessionUserFromDb(req);
    if (!canAccessCollaboratorSector(sessionUser, sector)) {
      return res.status(403).json({ error: 'VocÃª nÃ£o possui permissÃ£o para este setor.' });
    }
    const currentUser = req.session.userName || 'Dev';
    const result = await crmService.updateCollaborator(id, { name, ramal, sector }, currentUser);
    await socketService.broadcastDelta('COLLABORATOR_UPDATED', result.collaborator);
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });

    if (result.updatedNumbers && result.updatedNumbers.length > 0) {
      for (const num of result.updatedNumbers) {
        const dev = await crmService.deviceRepo.getById(num.device_id);
        const sectorName = dev ? dev.sector : 'Junior';
        await socketService.broadcastDelta('NUMBER_UPDATED', num, sectorName);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao editar colaborador:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.delete('/api/collaborators/:id', requireManagerAccess, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invÃ¡lido' });
  }
  try {
    const currentUser = req.session.userName || 'Dev';
    const result = await crmService.deleteCollaborator(id, currentUser);
    await socketService.broadcastDelta('COLLABORATOR_DELETED', { id });
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });

    if (result.updatedNumbers && result.updatedNumbers.length > 0) {
      for (const num of result.updatedNumbers) {
        const dev = await crmService.deviceRepo.getById(num.device_id);
        const sectorName = dev ? dev.sector : 'Junior';
        await socketService.broadcastDelta('NUMBER_UPDATED', num, sectorName);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar colaborador:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

// APIs de Gerenciamento de Gestores (Restrito ao Vicenzzo)
app.get('/api/users', requireMasterAccess, async (req, res) => {
  try {
    const users = await crmService.userRepo.getAll();
    const userIds = users.map(u => u.id);
    const allPermissions = await crmService.userRepo.getAllSectorPermissionsForActiveUsers(userIds);
    
    const usersWithPerms = users.map(user => {
      return {
        ...user,
        sectorPermissions: allPermissions.filter(p => p.user_id === user.id)
      };
    });
    return res.json(usersWithPerms);
  } catch (err) {
    console.error('Erro ao listar gestores:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/users', requireMasterAccess, async (req, res) => {
  const { username, name, password, is_readonly, ramal, allow_edit_devices, allow_manage_users } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'Todos os campos sÃ£o obrigatÃ³rios' });
  }

  const isReadonlyValue = is_readonly === 1 || is_readonly === true ? 1 : 0;
  const allowEditDevicesValue = isReadonlyValue === 1 ? 0 : (allow_edit_devices === 1 || allow_edit_devices === true ? 1 : 0);
  const allowManageUsersValue = isReadonlyValue === 1 ? 0 : (allow_manage_users === 1 || allow_manage_users === true ? 1 : 0);
  const allowDashboardValue = isReadonlyValue === 1 ? 0 : (req.body.allow_dashboard === 1 || req.body.allow_dashboard === true ? 1 : 0);

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.addUser({
      username,
      name,
      passwordHash: hash,
      isReadonly: isReadonlyValue,
      ramal,
      allowEditDevices: allowEditDevicesValue,
      allowManageUsers: allowManageUsersValue,
      allowDashboard: allowDashboardValue
    }, currentUserObj);
    
    await socketService.broadcastDelta('USER_ADDED', result.user);
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    await refreshUserSessions(result.user.id);
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao cadastrar gestor:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.delete('/api/users/:id', requireMasterAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'ID invÃ¡lido' });
  }

  try {
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.deleteUser(userId, currentUserObj);
    await socketService.broadcastDelta('USER_DELETED', { id: userId });
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao remover gestor:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.put('/api/users/:id/permissions', requireMasterAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { allow_all_tabs } = req.body;
  if (isNaN(userId) || (allow_all_tabs !== 0 && allow_all_tabs !== 1)) {
    return res.status(400).json({ error: 'ParÃ¢metros invÃ¡lidos' });
  }

  try {
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.updateUserPermissions(userId, allow_all_tabs, currentUserObj);
    
    // Notificar
    socketService.notifyUserPermissionUpdate(userId, allow_all_tabs);
    await socketService.broadcastDelta('USER_PERMISSIONS_UPDATED', { id: userId, allowAllTabs: allow_all_tabs });
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    await refreshUserSessions(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar permissÃ£o:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.put('/api/users/:id/readonly', requireMasterAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { is_readonly } = req.body;
  if (isNaN(userId) || (is_readonly !== 0 && is_readonly !== 1)) {
    return res.status(400).json({ error: 'ParÃ¢metros invÃ¡lidos' });
  }

  try {
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.updateUserReadonly(userId, is_readonly, currentUserObj);
    
    // Notificar
    socketService.notifyUserRoleUpdate(userId, is_readonly);
    await socketService.broadcastDelta('USER_READONLY_UPDATED', { id: userId, isReadonly: is_readonly });
    
    if (is_readonly === 1) {
      socketService.notifyUserEditDevicesUpdate(userId, 0);
      socketService.notifyUserManageUsersUpdate(userId, 0);
      await socketService.broadcastDelta('USER_EDIT_DEVICES_UPDATED', { id: userId, allowEditDevices: 0 });
      await socketService.broadcastDelta('USER_MANAGE_USERS_UPDATED', { id: userId, allowManageUsers: 0 });
    }
    
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    await refreshUserSessions(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar permissÃ£o readonly:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.put('/api/users/:id/active', requireMasterAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { is_active } = req.body;
  if (isNaN(userId) || (is_active !== 0 && is_active !== 1)) {
    return res.status(400).json({ error: 'ParÃ¢metros invÃ¡lidos' });
  }

  try {
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.updateUserActive(userId, is_active, currentUserObj);
    
    // Notificar
    socketService.notifyUserActiveUpdate(userId, is_active);
    await socketService.broadcastDelta('USER_ACTIVE_UPDATED', { id: userId, isActive: is_active });
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    await refreshUserSessions(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar permissÃ£o ativa:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.put('/api/users/:id/edit-devices', requireMasterAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { allow_edit_devices } = req.body;
  if (isNaN(userId) || (allow_edit_devices !== 0 && allow_edit_devices !== 1)) {
    return res.status(400).json({ error: 'ParÃ¢metros invÃ¡lidos' });
  }

  try {
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.updateUserEditDevices(userId, allow_edit_devices, currentUserObj);
    
    // Notificar
    socketService.notifyUserEditDevicesUpdate(userId, allow_edit_devices);
    await socketService.broadcastDelta('USER_EDIT_DEVICES_UPDATED', { id: userId, allowEditDevices: allow_edit_devices });
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    await refreshUserSessions(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar permissÃ£o de editar celulares:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.put('/api/users/:id/manage-users', requireMasterAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { allow_manage_users } = req.body;
  if (isNaN(userId) || (allow_manage_users !== 0 && allow_manage_users !== 1)) {
    return res.status(400).json({ error: 'ParÃ¢metros invÃ¡lidos' });
  }

  try {
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.updateUserManageUsers(userId, allow_manage_users, currentUserObj);
    
    // Notificar
    socketService.notifyUserManageUsersUpdate(userId, allow_manage_users);
    await socketService.broadcastDelta('USER_MANAGE_USERS_UPDATED', { id: userId, allowManageUsers: allow_manage_users });
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    await refreshUserSessions(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar permissÃ£o de cadastrar gestores:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.put('/api/users/:id/dashboard', requireMasterAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { allow_dashboard } = req.body;
  if (isNaN(userId) || (allow_dashboard !== 0 && allow_dashboard !== 1)) {
    return res.status(400).json({ error: 'ParÃ¢metros invÃ¡lidos' });
  }

  try {
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.updateUserDashboard(userId, allow_dashboard, currentUserObj);
    
    // Notificar
    socketService.notifyUserDashboardUpdate(userId, allow_dashboard);
    await socketService.broadcastDelta('USER_DASHBOARD_UPDATED', { id: userId, allowDashboard: allow_dashboard });
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });
    await refreshUserSessions(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar permissÃ£o de dashboard:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.get('/api/users/:id/permissions/sectors', requireSectorAdminAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'ID invÃ¡lido' });
  }

  try {
    const perms = await crmService.userRepo.getSectorPermissions(userId);
    return res.json(perms);
  } catch (err) {
    console.error('Erro ao buscar permissÃµes de setores:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/users/:id/permissions/sectors', requireSectorAdminAccess, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { permissions } = req.body;
  
  if (isNaN(userId) || !Array.isArray(permissions)) {
    return res.status(400).json({ error: 'ParÃ¢metros invÃ¡lidos' });
  }

  try {
    const currentUserObj = {
      username: req.session.username,
      name: req.session.userName,
      is_readonly: req.session.isReadonly ? 1 : 0
    };
    const result = await crmService.updateUserSectorPermissions(userId, permissions, currentUserObj);
    
    // Notificar
    socketService.notifyUserSectorPermissionsUpdate(userId, permissions);
    await socketService.broadcastDelta('USER_SECTOR_PERMISSIONS_UPDATED', { id: userId, permissions });
    await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: result.auditLog });

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar permissÃµes de setores:', err);
    return res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

app.post('/api/admin/update', requireMasterAccess, (req, res) => {
  console.log('Recebendo upload de atualizaÃ§Ã£o via web...');
  
  let data = [];
  req.on('data', chunk => {
    data.push(chunk);
  });
  
  req.on('end', async () => {
    try {
      const buffer = Buffer.concat(data);
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'Arquivo ZIP vazio ou nÃ£o enviado' });
      }
      
      const zipPath = path.join(__dirname, 'update_temp.zip');
      const dbFile = path.join(__dirname, 'database.sqlite');
      const dbBackup = path.join(__dirname, 'database.sqlite.bak');
      
      fs.writeFileSync(zipPath, buffer);
      console.log('Arquivo de atualizaÃ§Ã£o salvo temporariamente.');
      
      if (fs.existsSync(dbFile)) {
        fs.copyFileSync(dbFile, dbBackup);
        console.log('Backup do banco de dados criado com sucesso.');
      }
      
      try {
        // ExtraÃ§Ã£o SEGURA via Node.js
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(__dirname, true); // true = overwrite
        console.log('AtualizaÃ§Ã£o extraÃ­da com sucesso.');

        // Restaura o banco do backup para evitar que o ZIP tenha sobrescrito
        if (fs.existsSync(dbBackup)) {
          fs.copyFileSync(dbBackup, dbFile);
          fs.unlinkSync(dbBackup);
          console.log('Banco de dados restaurado do backup.');
        }

        // Limpa o ZIP temporÃ¡rio
        fs.unlinkSync(zipPath);

        res.json({ success: true, message: 'AtualizaÃ§Ã£o instalada com sucesso! O servidor estÃ¡ reiniciando...' });
        
        setTimeout(() => {
          console.log('Fechando processo para reinicializaÃ§Ã£o...');
          process.exit(0);
        }, 1500);

      } catch (extractError) {
        console.error('Erro ao extrair zip do update:', extractError);
        // Tenta limpar em caso de erro
        if (fs.existsSync(zipPath)) {
          try { fs.unlinkSync(zipPath); } catch (e) {}
        }
        if (fs.existsSync(dbBackup)) {
          try {
            fs.copyFileSync(dbBackup, dbFile);
            fs.unlinkSync(dbBackup);
          } catch (e) {}
        }
        return res.status(500).json({ error: 'Falha ao extrair arquivo de atualizaÃ§Ã£o: ' + extractError.message });
      }
      
    } catch (error) {
      console.error('Erro crÃ­tico no processo de atualizaÃ§Ã£o:', error);
      return res.status(500).json({ error: 'Erro interno no servidor durante a atualizaÃ§Ã£o' });
    }
  });
});

// Rotina para verificar timers expirados do CRM
async function checkExpiredTimersRoutine() {
  try {
    const changes = await crmService.checkExpiredTimers();
    if (changes && changes.length > 0) {
      for (const change of changes) {
        await socketService.broadcastDelta('NUMBER_UPDATED', change.number, change.sector);
        await socketService.broadcastDelta('LOG_ADDED', { type: 'general', log: change.auditLog });
      }
    }
  } catch (err) {
    console.error('Erro na rotina de verificaÃ§Ã£o de timers:', err);
  }
}

// Middleware global de tratamento de erros (RFC 7807)
app.use((err, req, res, next) => {
  console.error('Erro capturado pelo middleware global REST:', err);

  const status = err.status || 500;
  let title = 'Erro Interno do Servidor';
  let detail = err.message || 'Ocorreu um erro inesperado no servidor.';
  let type = 'about:blank';

  if (err.message && err.message.startsWith('CONCURRENCY_ERROR')) {
    return res.status(409).json({
      type: 'https://exemplo.com/errors/conflito-concorrencia',
      title: 'Conflito de ConcorrÃªncia',
      status: 409,
      detail: err.message.replace('CONCURRENCY_ERROR: ', ''),
      instance: req.originalUrl
    });
  }

  if (status === 404) {
    title = 'Recurso NÃ£o Encontrado';
  } else if (status === 403) {
    title = 'Acesso Proibido';
  } else if (status === 401) {
    title = 'NÃ£o Autorizado';
  } else if (status === 400) {
    title = 'RequisiÃ§Ã£o InvÃ¡lida';
  }

  return res.status(status).json({
    type,
    title,
    status,
    detail,
    instance: req.originalUrl
  });
});

// Evitar aviso de "Possible EventEmitter memory leak" (11 listeners de WebSocket)
// quando múltiplos clientes abrem/fechan a conexão rapidamente.
wss.setMaxListeners(50);

// Inicializar banco de dados e subir servidor
initDb().then(() => {
  const db = getDb();
  
  // Instanciar serviÃ§os da arquitetura corporativa
  crmService = new CrmService(db);
  socketService = new SocketService(wss, db, crmService);
  socketService.init();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[FATAL] A porta ${PORT} já está em uso por OUTRA instância. Encerrando para evitar crash-loop. Verifique se há processos órfãos (node server.js / pm2 duplicado).`);
      process.exit(1);
    } else {
      console.error('[FATAL] Erro no servidor HTTP:', err);
      process.exit(1);
    }
  });

  // Bind sem host (dual-stack IPv4+IPv6): sem isso, a porta 3000 ficava livre
  // no IPv6 e outro processo (ex.: python -m http.server servindo C:\realess-site)
  // podia roubar o tráfego de localhost e exibir o site antigo no lugar do CRM.
  server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    
    // Iniciar rotina periÃ³dica de verificaÃ§Ã£o de timers expirados a cada 5 segundos
    setInterval(checkExpiredTimersRoutine, 5000);
  });
}).catch(err => {
  console.error('Falha ao inicializar o banco de dados:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('ERRO NÃƒO TRATADO (uncaughtException):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('REJEIÃ‡ÃƒO NÃƒO TRATADA (unhandledRejection) em:', promise, 'motivo:', reason);
});

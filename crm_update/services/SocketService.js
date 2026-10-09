const WebSocket = require('ws');
const { PolicyEngine } = require('../security/PolicyEngine');

class SocketService {
  constructor(wss, db, crmService) {
    this.wss = wss;
    this.db = db;
    this.crmService = crmService;
    this.userRepo = crmService.userRepo;
    this.deviceRepo = crmService.deviceRepo;
    this.numberRepo = crmService.numberRepo;
    this.auditRepo = crmService.auditRepo;
    this.reservationRepo = crmService.reservationRepo;

    this.agentConnected = false;
    this.lastAgentHeartbeat = 0;
    this.msgCountToday = 0;
    this.msgsLastMinute = 0;

    // Chat em memória por setor (sector -> array de mensagens)
    this.chatMessages = new Map();
    this.chatMaxPerSector = 200;
    this.chatNextId = 1;

    // Intervalo para limpar mensagens por minuto e atualizar status
    setInterval(() => {
      this.msgsLastMinute = 0;
      this.broadcastAgentStatus();
    }, 60000);
  }

  // --- PERMISSÕES DE SETOR EM MEMÓRIA ---

  async getUserAllowedSectors(userId, username, permissionsMap) {
    const userMock = await this.userRepo.getById(userId) || {
      username,
      is_readonly: 0,
      allow_manage_users: 0,
      role: undefined
    };
    if (PolicyEngine.determineRole(userMock) === 'MASTER') return null; // Master vê tudo (null = sem filtro)

    const uName = (userMock.username || username || '').toLowerCase();
    const displayName = (userMock.name || '').toLowerCase();
    if (uName.includes('maiara') || displayName.includes('maiara')) {
      return ['PA FIXA 1', 'PA FIXA 2'];
    }

    if (userMock.allow_all_tabs === 1) return null; // Acesso global vê tudo
    
    const perms = permissionsMap[userId] || [];
    // Usuários com permissões cadastradas ficam limitados aos setores autorizados.
    if (perms.length === 0) {
      if (userMock.allow_all_tabs === 0) return [];
      return null;
    }
    
    return perms.filter(p => p.can_view === 1).map(p => p.sector);
  }

  async checkUserWritePermission(userId, username, sector) {
    const user = await this.userRepo.getById(userId);
    if (!user) return false;
    
    const userSectorPermissions = await this.userRepo.getSectorPermissions(userId);
    return PolicyEngine.canWriteInSector(user, sector, userSectorPermissions);
  }

  // --- ENVIAR ESTADOS (FILTRADOS EM MEMÓRIA) ---

  async sendFullState(ws, devices, numbers, permissionsMap) {
    try {
      const allowedSectors = await this.getUserAllowedSectors(ws.userId, ws.username, permissionsMap);
      
      let filteredDevices = devices;
      if (allowedSectors) {
        const collaborators = await this.crmService.collaboratorRepo.getAll();
        
        const findColabSector = (name) => {
          if (!name) return null;
          const nameLower = name.toLowerCase().trim();
          
          let colab = collaborators.find(c => c.name.toLowerCase().trim() === nameLower);
          if (colab) return colab.sector;
          
          colab = collaborators.find(c => c.name.toLowerCase().trim().startsWith(nameLower));
          if (colab) return colab.sector;
          
          colab = collaborators.find(c => {
            const cName = c.name.toLowerCase().trim();
            return cName.length > 3 && nameLower.includes(cName);
          });
          if (colab) return colab.sector;
          
          const searchFirstWord = nameLower.split(' ')[0];
          const ignoreWords = ['reserva', 'pesquisa', 'pa', 'fixa', 'backoffice', 'sem'];
          if (searchFirstWord && !ignoreWords.includes(searchFirstWord)) {
            colab = collaborators.find(c => c.name.split(' ')[0].toLowerCase().trim() === searchFirstWord);
            if (colab) return colab.sector;
          }
          return null;
        };

        filteredDevices = devices.filter(dev => {
          if (allowedSectors.includes(dev.sector)) return true;
          
          const devNumbers = numbers.filter(n => n.device_id === dev.id);
          return devNumbers.some(n => {
            const isReserva = dev.name.toLowerCase().includes('reserva') || (n.name && n.name.toLowerCase().includes('reserva'));
            if (isReserva) {
              const holders = n.holder ? String(n.holder).split(',').map(h => h.trim()).filter(Boolean) : [];
              return holders.some(h => {
                const s = findColabSector(h);
                return s && allowedSectors.includes(s);
              });
            } else {
              const negotiatorName = n.name || dev.name;
              const s = findColabSector(negotiatorName);
              return s && allowedSectors.includes(s);
            }
          });
        });
      }
        
      const devicesWithNumbers = filteredDevices.map(dev => {
        return {
          id: dev.id,
          name: dev.name,
          sector: dev.sector,
          origin_sector: dev.origin_sector,
          numbers: numbers.filter(n => n.device_id === dev.id)
        };
      });

      ws.send(JSON.stringify({
        type: 'FULL_STATE',
        data: devicesWithNumbers
      }));
    } catch (err) {
      console.error('Erro ao enviar estado completo para socket:', err);
    }
  }

  async sendLogs(ws, devices, allLogs, reservationLogs, permissionsMap) {
    try {
      const allowedSectors = await this.getUserAllowedSectors(ws.userId, ws.username, permissionsMap);
      
      const bans = allLogs.filter(log => log.action.includes('Banido') || log.action.includes('Restrito') || log.action.includes('liberação') || log.action.includes('expirada'));
      const general = allLogs.filter(log => !(log.action.includes('Banido') || log.action.includes('Restrito') || log.action.includes('liberação') || log.action.includes('expirada')));
      
      const filterBySector = (log) => {
        if (log.sector) return allowedSectors.includes(log.sector);
        if (log.device_name === '-') return true;
        const dev = devices.find(d => d.name === log.device_name);
        return dev ? allowedSectors.includes(dev.sector) : true;
      };

      const filteredBans = allowedSectors ? bans.filter(filterBySector) : bans;
      const filteredGeneral = allowedSectors ? general.filter(filterBySector) : general;
      const filteredReservations = allowedSectors ? reservationLogs.filter(filterBySector) : reservationLogs;

      ws.send(JSON.stringify({
        type: 'LOGS_UPDATE',
        data: { bans: filteredBans, general: filteredGeneral, reservations: filteredReservations }
      }));
    } catch (err) {
      console.error('Erro ao enviar logs para socket:', err);
    }
  }

  // --- CHAT EM MEMÓRIA (POR SETOR) ---

  addChatMessage(sector, sender, messageText) {
    const clean = String(messageText || '').trim();
    if (!sector || !sender || !clean) return null;

    const message = {
      id: this.chatNextId++,
      sector,
      sender: String(sender).slice(0, 120),
      message: clean.slice(0, 2000),
      timestamp: new Date().toISOString()
    };

    const list = this.chatMessages.get(sector) || [];
    list.push(message);
    if (list.length > this.chatMaxPerSector) {
      list.splice(0, list.length - this.chatMaxPerSector);
    }
    this.chatMessages.set(sector, list);
    return message;
  }

  async wsCanViewSector(ws, sector, permissionsMap) {
    const allowedSectors = await this.getUserAllowedSectors(ws.userId, ws.username, permissionsMap);
    if (allowedSectors === null) return true;
    return allowedSectors.includes(sector);
  }

  // --- BROADCAST OTIMIZADO DE DELTA (EVENT-DRIVEN) ---

  async broadcastDelta(eventType, payload, sector = null) {
    try {
      if (eventType === 'LOG_ADDED' && payload && payload.log) {
        if (!sector && payload.log.sector) {
          sector = payload.log.sector;
        }
        const action = payload.log.action;
        if (action && (action.includes('Banido') || action.includes('Restrito') || action.includes('liberação') || action.includes('expirada'))) {
          payload.type = 'bans';
        }
      }
      const onlineClients = Array.from(this.wss.clients).filter(c => c.readyState === WebSocket.OPEN);
      if (onlineClients.length === 0) return;

      const onlineUserIds = [...new Set(onlineClients.filter(c => c.userId).map(c => c.userId))];
      
      let permissionsMap = {};
      if (onlineUserIds.length > 0) {
        const allPermissions = await this.userRepo.getAllSectorPermissionsForActiveUsers(onlineUserIds);
        onlineUserIds.forEach(id => {
          permissionsMap[id] = allPermissions.filter(p => p.user_id === id);
        });
      }

      let collaborators = null;
      for (const client of onlineClients) {
        let hasAccess = true;
        if (sector) {
          const allowedSectors = await this.getUserAllowedSectors(client.userId, client.username, permissionsMap);
          if (allowedSectors && !allowedSectors.includes(sector)) {
            let hasCrossAccess = false;

            if (eventType.startsWith('NUMBER_') || eventType.startsWith('COLLABORATOR_')) {
              if (!collaborators) {
                collaborators = await this.crmService.collaboratorRepo.getAll();
              }

              const findColabSector = (name) => {
                if (!name) return null;
                const nameLower = name.toLowerCase().trim();
                let colab = collaborators.find(c => c.name.toLowerCase().trim() === nameLower);
                if (colab) return colab.sector;
                colab = collaborators.find(c => c.name.toLowerCase().trim().startsWith(nameLower));
                if (colab) return colab.sector;
                colab = collaborators.find(c => {
                  const cName = c.name.toLowerCase().trim();
                  return cName.length > 3 && nameLower.includes(cName);
                });
                if (colab) return colab.sector;
                const searchFirstWord = nameLower.split(' ')[0];
                const ignoreWords = ['reserva', 'pesquisa', 'pa', 'fixa', 'backoffice', 'sem'];
                if (searchFirstWord && !ignoreWords.includes(searchFirstWord)) {
                  colab = collaborators.find(c => c.name.split(' ')[0].toLowerCase().trim() === searchFirstWord);
                  if (colab) return colab.sector;
                }
                return null;
              };

              const colabName = payload.name || payload.holder || (payload.log ? payload.log.holder : null);
              if (colabName) {
                const s = findColabSector(colabName);
                if (s && allowedSectors.includes(s)) {
                  hasCrossAccess = true;
                }
              }

              if (payload.holder) {
                const holders = String(payload.holder).split(',').map(h => h.trim()).filter(Boolean);
                if (holders.some(h => {
                  const s = findColabSector(h);
                  return s && allowedSectors.includes(s);
                })) {
                  hasCrossAccess = true;
                }
              }
            }

            if (!hasCrossAccess) {
              hasAccess = false;
            }
          }
        }

        if (hasAccess) {
          // Tratar pings para latência do WebSocket do Gestor no Frontend
          client.on('message', (messageStr) => {
            try {
              const msg = JSON.parse(messageStr);
              if (msg.type === 'PING') {
                client.send(JSON.stringify({ type: 'PONG', timestamp: msg.timestamp }));
              }
            } catch(e) {}
          });

          client.send(JSON.stringify({
            type: 'DELTA_UPDATE',
            data: {
              event: eventType,
              payload
            }
          }));
        }
      }
    } catch (err) {
      console.error(`Erro no broadcast de delta (${eventType}):`, err);
    }
  }

  broadcastAgentStatus() {
    this.broadcastDelta('AGENT_STATUS_UPDATE', {
      connected: this.agentConnected,
      lastHeartbeat: this.lastAgentHeartbeat,
      msgCountToday: this.msgCountToday || 0,
      msgsLastMinute: this.msgsLastMinute || 0
    });
  }

  broadcastVeritasStatusUpdate(updatedNumbers) {
    if (!updatedNumbers || updatedNumbers.length === 0) return;
    this.broadcastDelta('NUMBER_VERITAS_STATUS_DELTA', {
      timestamp: new Date().toISOString(),
      updatedNumbers
    });
  }

  notifyUserDashboardUpdate(userId, allowDashboard) {
    this.wss.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.allowDashboard = !!allowDashboard;
        client.send(JSON.stringify({
          type: 'DASHBOARD_UPDATE',
          data: { allowDashboard }
        }));
      }
    });
  }

  // Mantido para carregamento inicial ou mudanças globais pesadas
  async broadcastState() {
    try {
      const [devices, numbers, allLogs, reservationLogs] = await Promise.all([
        this.deviceRepo.getAll(),
        this.numberRepo.getAll(),
        this.auditRepo.getLatest(200),
        this.reservationRepo.getLatest(200)
      ]);

      const onlineClients = Array.from(this.wss.clients).filter(c => c.readyState === WebSocket.OPEN);
      const onlineUserIds = [...new Set(onlineClients.filter(c => c.userId).map(c => c.userId))];
      
      let permissionsMap = {};
      if (onlineUserIds.length > 0) {
        const allPermissions = await this.userRepo.getAllSectorPermissionsForActiveUsers(onlineUserIds);
        onlineUserIds.forEach(id => {
          permissionsMap[id] = allPermissions.filter(p => p.user_id === id);
        });
      }

      for (const client of onlineClients) {
        await this.sendFullState(client, devices, numbers, permissionsMap);
        await this.sendLogs(client, devices, allLogs, reservationLogs, permissionsMap);
      }
    } catch (err) {
      console.error('Erro no broadcast de estado completo:', err);
    }
  }

  // --- NOTIFICAÇÕES INDIVIDUAIS DE PERMISSÕES ---

  notifyUserPermissionUpdate(userId, allowAllTabs) {
    this.wss.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'PERMISSION_UPDATE',
          data: { allowAllTabs }
        }));
      }
    });
  }
  notifyUserEditDevicesUpdate(userId, allowEditDevices) {
    this.wss.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.allowEditDevices = !!allowEditDevices;
        client.send(JSON.stringify({
          type: 'EDIT_DEVICES_UPDATE',
          data: { allowEditDevices }
        }));
      }
    });
  }

  notifyUserManageUsersUpdate(userId, allowManageUsers) {
    this.wss.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.allowManageUsers = !!allowManageUsers;
        client.send(JSON.stringify({
          type: 'MANAGE_USERS_UPDATE',
          data: { allowManageUsers }
        }));
      }
    });
  }

  notifyUserRoleUpdate(userId, isReadonly) {
    this.wss.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.isReadonly = !!isReadonly;
        client.send(JSON.stringify({
          type: 'ROLE_UPDATE',
          data: { isReadonly }
        }));
      }
    });
  }

  notifyUserActiveUpdate(userId, isActive) {
    this.wss.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'ACTIVE_UPDATE',
          data: { isActive }
        }));
        if (isActive === 0) {
          setTimeout(() => {
            client.close();
          }, 1000);
        }
      }
    });
  }

  notifyUserSectorPermissionsUpdate(userId, permissions) {
    this.wss.clients.forEach((client) => {
      if (client.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'SECTOR_PERMISSIONS_UPDATE',
          data: { permissions }
        }));
      }
    });
  }

  // --- INICIALIZAÇÃO E TRATAMENTO DE CONEXÕES ---

  init() {
    this.wss.on('connection', async (ws, request) => {
      // Se for Agente Python (USB Spoke)
      if (ws.isAgent) {
        console.log('Conexão WebSocket estabelecida com Agente Python (USB Spoke)');
        this.agentConnected = true;
        this.lastAgentHeartbeat = Date.now();
        this.broadcastAgentStatus();

        ws.on('message', async (messageStr) => {
          try {
            const message = JSON.parse(messageStr);
            if (message.type === 'EVT_MESSAGE_SENT') {
              this.msgCountToday = (this.msgCountToday || 0) + 1;
              this.msgsLastMinute = (this.msgsLastMinute || 0) + 1;
              await this.broadcastDelta('EVT_MESSAGE_SENT_DELTA', {
                timestamp: new Date().toISOString(),
                totalToday: this.msgCountToday,
                msgsLastMinute: this.msgsLastMinute
              });
            } else if (message.type === 'HEARTBEAT') {
              this.lastAgentHeartbeat = Date.now();
              this.agentConnected = true;
              this.broadcastAgentStatus();
            } else if (message.type === 'PING') {
              ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            }
          } catch (err) {
            console.error('Erro ao processar mensagem do Agente:', err);
          }
        });

        ws.on('close', () => {
          console.log('Conexão WebSocket fechada com Agente Python');
          this.agentConnected = false;
          this.broadcastAgentStatus();
        });
        return;
      }

      let dbUser = null;
      try {
        dbUser = await this.userRepo.getById(request.session.userId);
      } catch (err) {
        console.error('Erro ao buscar permissões frescas do usuário:', err);
      }

      const userName = (dbUser && (dbUser.name || dbUser.username)) || request.session.userName || request.session.username || 'Sistema';
      console.log(`Conexão WebSocket estabelecida com ${userName}`);

      ws.userId = request.session.userId;
      ws.username = (dbUser && dbUser.username) || request.session.username;
      ws.userName = userName;
      ws.isReadonly = dbUser ? !!dbUser.is_readonly : !!request.session.isReadonly;
      ws.allowEditDevices = dbUser ? !!dbUser.allow_edit_devices : !!request.session.allowEditDevices;
      ws.allowManageUsers = dbUser ? !!dbUser.allow_manage_users : !!request.session.allowManageUsers;
      ws.allowDashboard = dbUser ? !!dbUser.allow_dashboard : !!request.session.allowDashboard;

      try {
        const [devices, numbers, allLogs, reservationLogs] = await Promise.all([
          this.deviceRepo.getAll(),
          this.numberRepo.getAll(),
          this.auditRepo.getLatest(200),
          this.reservationRepo.getLatest(200)
        ]);

        const permissions = await this.userRepo.getSectorPermissions(ws.userId);
        const permissionsMap = { [ws.userId]: permissions };

        await this.sendFullState(ws, devices, numbers, permissionsMap);
        await this.sendLogs(ws, devices, allLogs, reservationLogs, permissionsMap);

        // Enviar status inicial do Dashboard e conexões de agentes
        ws.send(JSON.stringify({
          type: 'DASHBOARD_DATA',
          data: {
            agentConnected: this.agentConnected,
            lastAgentHeartbeat: this.lastAgentHeartbeat,
            msgCountToday: this.msgCountToday || 0,
            msgsLastMinute: this.msgsLastMinute || 0
          }
        }));
      } catch (err) {
        console.error('Erro ao enviar estado inicial para conexão WebSocket:', err);
      }

      // Tratar mensagens WebSocket vindas do cliente
      ws.on('message', async (messageStr) => {
        try {
          const message = JSON.parse(messageStr);
          const freshUser = await this.userRepo.getById(ws.userId);
          const currentUser = (freshUser && (freshUser.name || freshUser.username)) || ws.userName || request.session.userName || request.session.username || 'Gestor';

          console.log(`WebSocket recebeu do gestor ${currentUser}:`, message);

          // Bloquear modificações de usuários readonly ou sem permissões de setor
          const physicalActions = [
            'ADD_DEVICE', 'UPDATE_DEVICE', 'DELETE_DEVICE', 
            'ADD_NUMBER', 'DELETE_NUMBER', 'MOVE_NUMBER', 
            'UPDATE_NUMBER_DETAILS'
          ];
          const operationalActions = [
            'UPDATE_NUMBER_STATUS', 'CONFIRM_RELEASE', 'UPDATE_NUMBER_HOLDER',
            'UPDATE_NUMBER_FLAGS'
          ];

          if (physicalActions.includes(message.type) || operationalActions.includes(message.type)) {
            // Validar permissões em tempo real no banco: a sessão/ws pode estar
            // desatualizada (ex.: usuário promovido a gestor depois do login),
            // então a autorização sempre espelha o estado atual do usuário.
            const freshUser = await this.userRepo.getById(ws.userId);
            if (!freshUser || freshUser.is_active !== 1) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Sua conta não está ativa ou não foi encontrada. Entre em contato com o administrador.'
              }));
              return;
            }

            if (freshUser.is_readonly === 1) {
              console.warn(`Tentativa de modificação bloqueada por usuário readonly: ${currentUser}`);
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Você possui permissão apenas de visualização e não pode fazer alterações.'
              }));
              return;
            }

            // Ações físicas exigem a permissão de Editar Celulares (allow_edit_devices)
            if (physicalActions.includes(message.type)) {
              const wsUser = { 
                username: freshUser.username, 
                allow_edit_devices: freshUser.allow_edit_devices ? 1 : 0 
              };
              if (!PolicyEngine.canEditDevices(wsUser)) {
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  message: 'Você não tem permissão para criar, excluir ou editar celulares (aparelhos e chips).'
                }));
                return;
              }
            }

            // Validar permissão de escrita por setor
            let targetSector = null;

            if (message.type === 'ADD_DEVICE') {
              targetSector = message.payload.sector;
            } else if (message.type === 'UPDATE_DEVICE') {
              const { id, sector: newSector } = message.payload;
              const dev = await this.deviceRepo.getById(id);
              if (dev) {
                const hasAccessOld = await this.checkUserWritePermission(ws.userId, ws.username, dev.sector);
                const hasAccessNew = await this.checkUserWritePermission(ws.userId, ws.username, newSector);
                if (!hasAccessOld || !hasAccessNew) {
                  ws.send(JSON.stringify({
                    type: 'ERROR',
                    message: 'Você não tem permissão para configurar um dos setores envolvidos.'
                  }));
                  return;
                }
              }
            } else if (message.type === 'DELETE_DEVICE') {
              const { id } = message.payload;
              const dev = await this.deviceRepo.getById(id);
              if (dev) targetSector = dev.sector;
            } else if (message.type === 'MOVE_NUMBER') {
              const { numberId, targetDeviceId } = message.payload;
              const num = await this.numberRepo.getById(numberId);
              if (num) {
                const srcDev = await this.deviceRepo.getById(num.device_id);
                const dstDev = await this.deviceRepo.getById(targetDeviceId);
                if (srcDev && dstDev) {
                  const hasAccessSrc = await this.checkUserWritePermission(ws.userId, ws.username, srcDev.sector);
                  const hasAccessDst = await this.checkUserWritePermission(ws.userId, ws.username, dstDev.sector);
                  if (!hasAccessSrc || !hasAccessDst) {
                    ws.send(JSON.stringify({
                      type: 'ERROR',
                      message: 'Você não tem permissão para configurar um dos setores envolvidos na transferência.'
                    }));
                    return;
                  }
                }
              }
            } else if (message.type === 'ADD_NUMBER') {
              const { deviceId } = message.payload;
              const dev = await this.deviceRepo.getById(deviceId);
              if (dev) targetSector = dev.sector;
            } else {
              const numberId = message.payload.numberId || message.payload.id;
              if (numberId) {
                const num = await this.numberRepo.getById(numberId);
                if (num) {
                  const dev = await this.deviceRepo.getById(num.device_id);
                  if (dev) targetSector = dev.sector;
                }
              }
            }

            if (targetSector) {
              const hasAccess = await this.checkUserWritePermission(ws.userId, ws.username, targetSector);
              if (!hasAccess) {
                console.warn(`Tentativa de modificação bloqueada no setor "${targetSector}" por falta de permissão: ${currentUser}`);
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  message: `Você não possui permissão para fazer alterações no setor ${targetSector}.`
                }));
                return;
              }
            }
          }

          // Executar as ações chamando a camada de serviços (CrmService) e disparar deltas
          switch (message.type) {
            case 'ADD_DEVICE': {
              const { name, sector } = message.payload;
              const res = await this.crmService.addDevice({ name, sector }, currentUser);
              await this.broadcastDelta('DEVICE_ADDED', res.device, sector);
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              break;
            }

            case 'UPDATE_DEVICE': {
              const { id, name, sector } = message.payload;
              const res = await this.crmService.updateDevice(id, { name, sector }, currentUser);
              await this.broadcastDelta('DEVICE_UPDATED', res.device, sector);
              if (res.oldSector !== sector) {
                await this.broadcastDelta('DEVICE_UPDATED', res.device, res.oldSector);
              }
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              break;
            }

            case 'DELETE_DEVICE': {
              const { id } = message.payload;
              const res = await this.crmService.deleteDevice(id, currentUser);
              await this.broadcastDelta('DEVICE_DELETED', { id }, res.sector);
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              break;
            }

            case 'ADD_NUMBER': {
              const { deviceId, phoneNumber, name, holder } = message.payload;
              const res = await this.crmService.addNumber({ deviceId, phoneNumber, name, holder }, currentUser);
              await this.broadcastDelta('NUMBER_ADDED', res.number, res.sector);
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              break;
            }

            case 'UPDATE_NUMBER_HOLDER': {
              const { numberId, holder, versao } = message.payload;
              const res = await this.crmService.updateNumberHolder(numberId, holder, versao, currentUser);
              await this.broadcastDelta('NUMBER_UPDATED', res.number, res.sector);
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              if (res.reservationLog) {
                await this.broadcastDelta('LOG_ADDED', { type: 'reservations', log: res.reservationLog });
              }
              break;
            }

            case 'UPDATE_NUMBER_STATUS': {
              const { numberId, status, durationMinutes, startTime, holder, versao } = message.payload;
              const res = await this.crmService.updateNumberStatus(numberId, { status, durationMinutes, startTime, holder, versao }, currentUser);
              await this.broadcastDelta('NUMBER_UPDATED', res.number, res.sector);
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              break;
            }

            case 'UPDATE_NUMBER_FLAGS': {
              const { numberId, siteHistoryActive, inHand, versao } = message.payload;
              const flagUser = await this.userRepo.getById(ws.userId);
              if (!flagUser || !PolicyEngine.canEditDevices({ username: flagUser.username, allow_edit_devices: flagUser.allow_edit_devices ? 1 : 0 })) {
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  message: 'Somente gestores autorizados podem ligar/desligar as chaves do chip.'
                }));
                return;
              }
              const res = await this.crmService.updateNumberFlags(numberId, { siteHistoryActive, inHand, versao }, currentUser);
              await this.broadcastDelta('NUMBER_UPDATED', res.number, res.sector);
              if (res.auditLog) {
                await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              }
              break;
            }

            case 'GET_CHAT_HISTORY': {
              const sector = message.payload && message.payload.sector;
              if (!sector) return;
              const permissions = await this.userRepo.getSectorPermissions(ws.userId);
              const permissionsMap = { [ws.userId]: permissions };
              const canView = await this.wsCanViewSector(ws, sector, permissionsMap);
              if (!canView) {
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  message: 'Você não possui acesso ao chat desse setor.'
                }));
                return;
              }
              ws.send(JSON.stringify({
                type: 'CHAT_HISTORY',
                data: { sector, messages: this.chatMessages.get(sector) || [] }
              }));
              break;
            }

            case 'SEND_CHAT_MESSAGE': {
              const { sector, sender, message: text } = message.payload;
              if (!sector || !sender || !text) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Setor, remetente e mensagem são obrigatórios.' }));
                return;
              }
              const permissions = await this.userRepo.getSectorPermissions(ws.userId);
              const permissionsMap = { [ws.userId]: permissions };
              const canView = await this.wsCanViewSector(ws, sector, permissionsMap);
              if (!canView) {
                ws.send(JSON.stringify({
                  type: 'ERROR',
                  message: 'Você não possui acesso ao chat desse setor.'
                }));
                return;
              }
              const chatMessage = this.addChatMessage(sector, sender, text);
              if (chatMessage) {
                await this.broadcastDelta('CHAT_MESSAGE_ADDED', { chatMessage }, sector);
              }
              break;
            }

            case 'CONFIRM_RELEASE': {
              const { numberId, versao } = message.payload;
              const res = await this.crmService.confirmRelease(numberId, versao, currentUser);
              await this.broadcastDelta('NUMBER_UPDATED', res.number, res.sector);
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              break;
            }

            case 'MOVE_NUMBER': {
              const { numberId, targetDeviceId, versao } = message.payload;
              const res = await this.crmService.moveNumber(numberId, targetDeviceId, versao, currentUser);
              await this.broadcastDelta('NUMBER_UPDATED', res.number, res.srcSector);
              if (res.srcSector !== res.dstSector) {
                await this.broadcastDelta('NUMBER_UPDATED', res.number, res.dstSector);
              }
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              break;
            }

            case 'DELETE_NUMBER': {
              const { numberId, versao } = message.payload;
              const res = await this.crmService.deleteNumber(numberId, versao, currentUser);
              await this.broadcastDelta('NUMBER_DELETED', { id: numberId, deviceId: res.deviceId }, res.sector);
              await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              break;
            }

            case 'UPDATE_NUMBER_DETAILS': {
              const { numberId, name, phoneNumber, versao } = message.payload;
              const res = await this.crmService.updateNumberDetails(numberId, { name, phoneNumber, versao }, currentUser);
              await this.broadcastDelta('NUMBER_UPDATED', res.number, res.sector);
              if (res.auditLog) {
                await this.broadcastDelta('LOG_ADDED', { type: 'general', log: res.auditLog });
              }
              break;
            }

            default:
              console.warn('Tipo de mensagem desconhecido:', message.type);
          }
        } catch (err) {
          console.error('Erro ao processar mensagem WebSocket:', err);
          let errorMsg = err.message || 'Ocorreu um erro ao processar a ação.';
          if (err.message && err.message.startsWith('CONCURRENCY_ERROR')) {
            errorMsg = err.message.replace('CONCURRENCY_ERROR: ', '');
          }
          ws.send(JSON.stringify({
            type: 'ERROR',
            message: errorMsg
          }));
        }
      });

      ws.on('close', () => {
        console.log(`Conexão WebSocket fechada com ${userName}`);
      });
    });
  }
}

module.exports = SocketService;

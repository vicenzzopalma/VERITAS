document.addEventListener('DOMContentLoaded', () => {
  // Captura e preserva o token SSO JWT vindo do VERITAS
  const urlParams = new URLSearchParams(window.location.search);
  let ssoToken = urlParams.get('sso_token') || '';
  if (ssoToken) {
    sessionStorage.setItem('crm_sso_token', ssoToken);
  } else {
    ssoToken = sessionStorage.getItem('crm_sso_token') || localStorage.getItem('token') || '';
    try {
      const parsed = JSON.parse(ssoToken);
      if (typeof parsed === 'string') ssoToken = parsed;
    } catch (e) {}
  }

  // Interceptar transparentemente o fetch para anexar o token SSO no cabeçalho
  if (ssoToken) {
    const origFetch = window.fetch;
    window.fetch = function(url, options = {}) {
      options = options || {};
      options.headers = options.headers || {};
      if (typeof options.headers.set === 'function') {
        if (!options.headers.has('x-sso-token')) options.headers.set('x-sso-token', ssoToken);
        if (!options.headers.has('Authorization')) options.headers.set('Authorization', `Bearer ${ssoToken}`);
      } else {
        if (!options.headers['x-sso-token']) options.headers['x-sso-token'] = ssoToken;
        if (!options.headers['Authorization']) options.headers['Authorization'] = `Bearer ${ssoToken}`;
      }
      return origFetch.call(this, url, options);
    };
  }

  let currentUser = null;
  let socket = null;
  let currentSector = 'Junior';
  let currentSubSector = 'PA FIXA 1';

  // --- Persistência e Interoperabilidade de Setores (VERITAS <-> CRM) ---
  function getSavedSectorState() {
    try {
      const saved = localStorage.getItem('veritas:selectedSector') || localStorage.getItem('crm_selected_sector');
      if (!saved) return null;
      if (saved === 'PA FIXA 1' || saved === 'PA FIXA 2') {
        return { sector: 'PA FIXA', subSector: saved };
      }
      if (saved === 'PA FIXA') {
        const savedSub = localStorage.getItem('crm_selected_subsector');
        return { sector: 'PA FIXA', subSector: (savedSub === 'PA FIXA 2' ? 'PA FIXA 2' : 'PA FIXA 1') };
      }
      if (saved.toUpperCase() === 'TODOS') {
        return { sector: 'Todos', subSector: 'PA FIXA 1' };
      }
      const validSectors = ['Junior', 'Senior', 'Pesquisa', 'Juridico', 'Comercial'];
      if (validSectors.includes(saved)) {
        return { sector: saved, subSector: 'PA FIXA 1' };
      }
    } catch (e) {}
    return null;
  }

  const initialSavedSector = getSavedSectorState();
  if (initialSavedSector) {
    currentSector = initialSavedSector.sector;
    currentSubSector = initialSavedSector.subSector;
  }

  function persistCurrentSector() {
    try {
      let veritasSector = currentSector;
      if (currentSector === 'PA FIXA') {
        veritasSector = currentSubSector || 'PA FIXA 1';
      } else if (currentSector === 'Todos') {
        veritasSector = 'TODOS';
      }
      localStorage.setItem('veritas:selectedSector', veritasSector);
      localStorage.setItem('crm_selected_sector', currentSector);
      if (currentSubSector) {
        localStorage.setItem('crm_selected_subsector', currentSubSector);
      }
    } catch (e) {}
  }

  function syncSectorTabsUI() {
    const sectorTabsContainer = document.getElementById('sector-tabs');
    if (!sectorTabsContainer) return;

    sectorTabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
      const btnSector = btn.getAttribute('data-sector');
      if (btnSector === currentSector) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const splitTab = document.getElementById('tab-pa-fixa');
    if (splitTab) {
      const splitLabel = splitTab.querySelector('.split-label');
      if (splitLabel) {
        splitLabel.textContent = currentSector === 'PA FIXA' ? currentSubSector : 'PA FIXA';
      }
      const choices = splitTab.querySelectorAll('.split-choice');
      choices.forEach(c => {
        if (currentSector === 'PA FIXA' && c.getAttribute('data-subsector') === currentSubSector) {
          c.classList.add('active-sub');
        } else {
          c.classList.remove('active-sub');
        }
      });
    }
  }

  function isRestrictedPaFixaUser(user) {
    if (!user) return false;
    const u = (user.username || '').toLowerCase();
    const n = (user.name || '').toLowerCase();
    if (u === 'vicenzzo' || u === 'admin') return false;
    if (u.includes('maiara') || n.includes('maiara')) return true;
    const perms = Array.isArray(user.sectorPermissions) ? user.sectorPermissions : [];
    if (perms.length > 0) {
      const hasOther = perms.some(p => p.can_view === 1 && !['PA FIXA 1', 'PA FIXA 2', 'PA FIXA'].includes(p.sector));
      const hasPA = perms.some(p => p.can_view === 1 && ['PA FIXA 1', 'PA FIXA 2', 'PA FIXA'].includes(p.sector));
      if (hasPA && !hasOther) return true;
    }
    return false;
  }

  function restoreSavedSector(triggerRender = true) {
    const isPaFixaOnly = isRestrictedPaFixaUser(currentUser);
    const saved = getSavedSectorState();
    if (!saved && !isPaFixaOnly) return false;

    let targetSector = saved ? saved.sector : 'PA FIXA';
    let targetSubSector = saved ? saved.subSector : 'PA FIXA 1';

    if (isPaFixaOnly) {
      targetSector = 'PA FIXA';
      if (targetSubSector !== 'PA FIXA 1' && targetSubSector !== 'PA FIXA 2') {
        targetSubSector = 'PA FIXA 1';
      }
    } else if (currentUser && currentUser.username !== 'vicenzzo' && currentUser.allowAllTabs !== 1 && currentUser.allowAllTabs !== true) {
      const perms = Array.isArray(currentUser.sectorPermissions) ? currentUser.sectorPermissions : [];
      if (targetSector === 'Todos') {
        targetSector = 'Junior';
      }
      const canView = perms.some(p => {
        if (targetSector === 'PA FIXA') {
          return (p.sector === targetSubSector || p.sector === 'PA FIXA 1' || p.sector === 'PA FIXA 2') && p.can_view === 1;
        }
        return p.sector === targetSector && p.can_view === 1;
      });
      if (!canView) return false;
    }

    const changed = (targetSector !== currentSector || targetSubSector !== currentSubSector);
    currentSector = targetSector;
    currentSubSector = targetSubSector;

    syncSectorTabsUI();

    if (changed && triggerRender && typeof renderDevices === 'function' && devicesData && devicesData.length > 0) {
      renderDevices();
    }
    return changed;
  }

  let currentFilter = 'all';
  let searchQuery = '';
  let showOnlyReservas = false;
  let notifiedAlarms = new Set();
  let openAlarmPopups = {}; // Rastrear popups abertos por numberId
  let devicesData = [];
  let countdownIntervals = {};


  // PERF: util de debounce para evitar re-render a cada tecla digitada
  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // PERF: ticker global de countdowns (1 timer p/ todos os chips em vez de
  // 1 setInterval por número -> evita dezenas de timers de 1s em máquinas fracas)
  const countdownTargets = new Map(); // numberId -> { targetTime, rowElement, timerArea, alarmArea }
  let globalCountdownTicker = null;

  function tickAllCountdowns() {
    const now = Date.now();
    const expired = [];
    countdownTargets.forEach((info, numberId) => {
      const diff = info.targetTime - now;
      if (diff <= 0) {
        expired.push(numberId);
        return;
      }
      // Converter diferença em dias, horas, minutos e segundos
      const days = Math.floor(diff / 8.64e7);
      const hrs = Math.floor((diff % 8.64e7) / 3.6e6);
      const mins = Math.floor((diff % 3.6e6) / 6e4);
      const secs = Math.floor((diff % 6e4) / 1000);
      const display = document.getElementById(`countdown-${numberId}`);
      if (display) {
        display.textContent = days > 0
          ? `${days}d ${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`
          : `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    });
    expired.forEach(numberId => {
      const info = countdownTargets.get(numberId);
      countdownTargets.delete(numberId);
      const timerArea = info.timerArea;
      const rowElement = info.rowElement;
      const alarmArea = info.alarmArea;
      if (timerArea) timerArea.style.display = 'none';
      if (rowElement) rowElement.classList.add('alarm-ringing');
      if (alarmArea) {
        alarmArea.style.display = 'block';
        const isReadonly = currentUser && (currentUser.isReadonly === 1 || currentUser.isReadonly === true);
        alarmArea.innerHTML = `
          <div class="alarm-banner" style="font-size: 0.75rem; padding: 4px 8px;">
            <span>⏰ CHIP LIBERADO!</span>
            ${!isReadonly ? `<button class="btn-confirm-release" data-number-id="${numberId}" style="font-size: 0.7rem; padding: 1px 5px;">Confirmar</button>` : ''}
          </div>
        `;
        // Disparar Notificação do Windows e abrir Popup de Alarme (comportamento original)
        if (!isReadonly && !notifiedAlarms.has(numberId)) {
          notifiedAlarms.add(numberId);
          let deviceName = 'Aparelho';
          let chipName = 'Chip';
          let phoneRaw = '';
          let formattedPhone = '';
          const devObj = devicesData.find(d => d.numbers && d.numbers.some(n => n.id === numberId));
          if (devObj) {
            deviceName = devObj.name;
            const numObj = devObj.numbers.find(n => n.id === numberId);
            if (numObj) {
              chipName = numObj.name;
              phoneRaw = numObj.phone_number;
              formattedPhone = formatPhoneNumber(numObj.phone_number);
            }
          }
          notifyExpiredChip(numberId, deviceName, chipName, phoneRaw, formattedPhone);
        }
        const confirmBtn = alarmArea.querySelector('.btn-confirm-release');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => {
            sendWSMessage('CONFIRM_RELEASE', { numberId, versao: getNumberVersion(numberId) });
            notifiedAlarms.delete(numberId);
            if (openAlarmPopups[numberId] && !openAlarmPopups[numberId].closed) {
              openAlarmPopups[numberId].close();
            }
            delete openAlarmPopups[numberId];
          });
        }
      }
    });
    if (countdownTargets.size === 0 && globalCountdownTicker) {
      clearInterval(globalCountdownTicker);
      globalCountdownTicker = null;
    }
  }

  function notifyExpiredChip(numberId, deviceName, chipName, phoneRaw, formattedPhone) {
    try {
      triggerSystemNotification(
        '⏰ Chip Liberado no CRM!',
        `O chip "${chipName}" (${formattedPhone}) no aparelho "${deviceName}" foi liberado da restrição.`,
        `alarm-${numberId}`
      );
      openAlarmPopup(numberId, deviceName, chipName, phoneRaw);
    } catch (e) { /* no-op */ }
  }

  function startGlobalCountdown(numberId, targetIsoStr, rowElement, timerArea, alarmArea) {
    const targetTime = new Date(targetIsoStr).getTime();
    countdownTargets.set(numberId, { targetTime, rowElement, timerArea, alarmArea });
    if (!globalCountdownTicker) {
      globalCountdownTicker = setInterval(tickAllCountdowns, 1000);
    }
    tickAllCountdowns();
  }

  function clearAllCountdowns() {
    countdownTargets.clear();
    if (globalCountdownTicker) {
      clearInterval(globalCountdownTicker);
      globalCountdownTicker = null;
    }
    countdownIntervals = {};
  }
  
  // Dados de Logs
  let logsData = { bans: [], general: [], reservations: [] };
  let currentLogTab = 'bans';
  let logFilterSector = 'all';
  let logFilterManager = 'all';
  let systemUsers = [];
  let holderChips = new Map();
  let selectHolderNumberId = null;
  let holderLists = new Map();
  let managerSearchQuery = '';
  let collaboratorSearchQuery = '';

  // Estado do Chat Flutuante
  let currentChatSector = null;
  let chatHistoryBySector = {};
  let chatUnreadBySector = {};
  let chatPanelOpen = false;

  // Elementos do DOM
  const connectionStatus = document.getElementById('connection-status');
  const userDisplayName = document.getElementById('user-display-name');
  const btnLogout = document.getElementById('btn-logout');
  const sectorTabs = document.getElementById('sector-tabs');
  const devicesContainer = document.getElementById('devices-container');
  
  // Elementos de Logs
  const btnOpenLogs = document.getElementById('btn-open-logs');
  const modalLogs = document.getElementById('modal-logs');
  const logTabs = document.getElementById('log-tabs');
  const modalLogsTbody = document.getElementById('modal-logs-tbody');
  const btnExportLogs = document.getElementById('btn-export-logs');

  // Elementos de Inventário
  const btnOpenInventory = document.getElementById('btn-open-inventory');
  const modalInventory = document.getElementById('modal-inventory');
  const inventoryTbody = document.getElementById('inventory-tbody');
  const inventoryCount = document.getElementById('inventory-count');
  const inventorySectorTabs = document.getElementById('inventory-sector-tabs');
  let currentInventorySector = 'Todos';

  // Botões de abertura de modais
  const btnOpenAddDevice = document.getElementById('btn-open-add-device');

  // Modais de Cadastro
  const modalAddDevice = document.getElementById('modal-add-device');
  const modalEditDevice = document.getElementById('modal-edit-device');
  const modalAddNumber = document.getElementById('modal-add-number');
  const modalRestrictionSettings = document.getElementById('modal-restriction-settings');

  // Formulários
  const formAddDevice = document.getElementById('form-add-device');
  const formEditDevice = document.getElementById('form-edit-device');
  const formAddNumber = document.getElementById('form-add-number');
  const formRestrictionSettings = document.getElementById('form-restriction-settings');

  // Outros controles de formulário
  const btnDeleteDevice = document.getElementById('btn-delete-device');

  // Elementos do Modal de Gestão de Gestores
  const modalManageUsers = document.getElementById('modal-manage-users');
  const manageUsersCardsContainer = document.getElementById('manage-users-cards-container');
  const formManageUsers = document.getElementById('form-manage-users');
  const manageUsersErrorMsg = document.getElementById('manage-users-error-msg');

  // Elementos de Gestão de Colaboradores
  const manageCollaboratorsCardsContainer = document.getElementById('manage-collaborators-cards-container');
  const formManageCollaborators = document.getElementById('form-manage-collaborators');
  const manageColabsErrorMsg = document.getElementById('manage-colabs-error-msg');
  const searchManagersInput = document.getElementById('search-managers-input');
  const searchCollaboratorsInput = document.getElementById('search-collaborators-input');

  // Elementos do Modal de Editar Colaborador
  const modalEditColaborador = document.getElementById('modal-edit-colaborador');
  const formEditColaborador = document.getElementById('form-edit-colaborador');
  const editColabErrorMsg = document.getElementById('edit-colab-error-msg');
  const editColabName = document.getElementById('edit-colab-name');
  const editColabRamal = document.getElementById('edit-colab-ramal');
  const editColabClose = document.getElementById('modal-edit-colab-close');
  let editingColabId = null;

  // Elementos do Dashboard
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const modalDashboard = document.getElementById('modal-dashboard');
  const dashboardFilterSector = document.getElementById('dashboard-filter-sector');
  const agentIndicator = document.getElementById('agent-indicator');
  const wsLatency = document.getElementById('ws-latency');
  const kpiLifespan = document.getElementById('kpi-lifespan');
  const kpiBurnRate = document.getElementById('kpi-burn-rate');
  const kpiMttr = document.getElementById('kpi-mttr');
  const kpiMessagesTotal = document.getElementById('kpi-messages-total');
  const kpiMessagesRate = document.getElementById('kpi-messages-rate');
  
  const valTotalBloqueios = document.getElementById('val-total-bloqueios');
  const valTotalMutacoes = document.getElementById('val-total-mutacoes');
  const valTotalContingencia = document.getElementById('val-total-contingencia');
  
  const agentStatusDaemon = document.getElementById('agent-status-daemon');
  const agentStatusWs = document.getElementById('agent-status-ws');
  const agentLastHeartbeat = document.getElementById('agent-last-heartbeat');
  const agentTokenStatus = document.getElementById('agent-token-status');

  const btnDashTabAnalytics = document.getElementById('btn-dash-tab-analytics');
  const btnDashTabDiagnostics = document.getElementById('btn-dash-tab-diagnostics');
  const dashTabContentAnalytics = document.getElementById('dash-tab-content-analytics');
  const dashTabContentDiagnostics = document.getElementById('dash-tab-content-diagnostics');
  const dashDiagnosticsCount = document.getElementById('dash-diagnostics-count');
  const dashAlertsContainer = document.getElementById('dash-alerts-container');
  const rankOperadoresTbody = document.getElementById('rank-operadores-tbody');
  const rankChipsTbody = document.getElementById('rank-chips-tbody');

  // Elementos do Radar de Atrito & Duelo
  const dashboardFilterPeriod = document.getElementById('dashboard-filter-period');
  const btnDuelViewOps = document.getElementById('btn-duel-view-ops');
  const btnDuelViewAudit = document.getElementById('btn-duel-view-audit');
  const duelContainerOperators = document.getElementById('duel-container-operators');
  const duelContainerAuditors = document.getElementById('duel-container-auditors');
  const duelIntelText = document.getElementById('duel-intel-text');
  const valAtritoPct = document.getElementById('val-atrito-pct');
  const valPreservacaoPct = document.getElementById('val-preservacao-pct');
  const duelBarAtrito = document.getElementById('duel-bar-atrito');
  const duelBarPreservacao = document.getElementById('duel-bar-preservacao');
  const listTopBanidores = document.getElementById('list-top-banidores');
  const listTopGuardioes = document.getElementById('list-top-guardioes');
  const listTopAuditoresTbody = document.getElementById('list-top-auditores-tbody');
  const btnExportDashboardPdf = document.getElementById('btn-export-dashboard-pdf');

  let currentDashboardSector = 'all';
  let currentDashboardPeriod = 'all';
  let latestDashboardStats = null;
  let chartStatusInstance = null;
  let chartHorasInstance = null;
  let chartThroughputInstance = null;
  let chartAtritoInstance = null;
  
  let throughputDataPoints = [];
  let throughputLabels = [];
  let pingInterval = null;
  let lastPingTime = 0;

  // Elementos de Permissões de Setor e Updates (Novos)


  const formSystemUpdate = document.getElementById('form-system-update');
  const updateZipFile = document.getElementById('update-zip-file');
  const updateProgressContainer = document.getElementById('update-progress-container');
  const updateStatusText = document.getElementById('update-status-text');
  const updatePercentage = document.getElementById('update-percentage');
  const updateProgressBar = document.getElementById('update-progress-bar');
  const updateErrorMsg = document.getElementById('update-error-msg');
  const updateSuccessMsg = document.getElementById('update-success-msg');
  const btnSubmitUpdate = document.getElementById('btn-submit-update');
  
  const searchInput = document.getElementById('search-input');
  const subsectorTabs = document.getElementById('subsector-tabs');

  // Elementos do Modal de Seleção de Responsável (Lupa)
  const modalSelectHolder = document.getElementById('modal-select-holder');
  const searchHolderInput = document.getElementById('search-holder-input');
  const selectHolderList = document.getElementById('select-holder-list');

  // Elementos do Chat Flutuante
  const chatFab = document.getElementById('chat-fab');
  const chatFabBadge = document.getElementById('chat-fab-badge');
  const chatPanel = document.getElementById('chat-panel');
  const chatMessagesEl = document.getElementById('chat-messages');
  const chatSectorSelect = document.getElementById('chat-sector-select');
  const chatSenderSelect = document.getElementById('chat-sender-select');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatCloseBtn = document.getElementById('chat-close-btn');

  const availableSectors = ['Junior', 'Senior', 'PA FIXA 1', 'PA FIXA 2', 'Pesquisa', 'Juridico', 'Comercial'];

  function canConfigureSector(sector) {
    if (!currentUser) return false;
    if (currentUser.username === 'vicenzzo') return true;
    if (currentUser.isReadonly === 1 || currentUser.isReadonly === true) return false;
    
    if (currentUser.sectorPermissions && currentUser.sectorPermissions.length > 0) {
      const perm = currentUser.sectorPermissions.find(p => p.sector === sector);
      return perm ? perm.can_configure === 1 : false;
    }
    return false;
  }

  function canViewAnySector() {
    if (!currentUser) return false;
    if (currentUser.username === 'vicenzzo') return true;
    
    if (currentUser.sectorPermissions && currentUser.sectorPermissions.length > 0) {
      return currentUser.sectorPermissions.some(p => p.can_view === 1);
    }
    return false;
  }

  function updateAllTabsVisibility() {
    const tabAll = document.getElementById('tab-all');
    if (!tabAll) return;

    const isPaFixaOnly = isRestrictedPaFixaUser(currentUser);
    if (isPaFixaOnly && currentUser) {
      currentUser.allowAllTabs = 0;
    }

    const hasGlobalTabs = !isPaFixaOnly && currentUser && (currentUser.username === 'vicenzzo' || currentUser.allowAllTabs === 1 || currentUser.allowAllTabs === true);

    if (hasGlobalTabs) {
      tabAll.style.display = 'inline-block';
    } else {
      tabAll.style.display = 'none';
      if (currentSector === 'Todos') {
        currentSector = isPaFixaOnly ? 'PA FIXA' : 'Junior';
        persistCurrentSector();
      }
    }

    if (!hasGlobalTabs) {
      const perms = Array.isArray(currentUser ? currentUser.sectorPermissions : []) ? currentUser.sectorPermissions : [];
      const canViewJunior = !isPaFixaOnly && perms.some(p => p.sector === 'Junior' && p.can_view === 1);
      const canViewSenior = !isPaFixaOnly && perms.some(p => p.sector === 'Senior' && p.can_view === 1);
      const canViewPA1 = isPaFixaOnly || perms.some(p => p.sector === 'PA FIXA 1' && p.can_view === 1);
      const canViewPA2 = isPaFixaOnly || perms.some(p => p.sector === 'PA FIXA 2' && p.can_view === 1);
      const canViewPesquisa = !isPaFixaOnly && perms.some(p => p.sector === 'Pesquisa' && p.can_view === 1);
      const canViewJuridico = !isPaFixaOnly && perms.some(p => p.sector === 'Juridico' && p.can_view === 1);
      const canViewComercial = !isPaFixaOnly && perms.some(p => p.sector === 'Comercial' && p.can_view === 1);

      document.querySelectorAll('#sector-tabs .tab-btn').forEach(btn => {
        const sec = btn.getAttribute('data-sector');
        if (sec === 'Junior') {
          btn.style.display = canViewJunior ? 'inline-block' : 'none';
        } else if (sec === 'Senior') {
          btn.style.display = canViewSenior ? 'inline-block' : 'none';
        } else if (sec === 'PA FIXA') {
          btn.style.display = (canViewPA1 || canViewPA2) ? 'inline-block' : 'none';
        } else if (sec === 'Pesquisa') {
          btn.style.display = canViewPesquisa ? 'inline-block' : 'none';
        } else if (sec === 'Juridico') {
          btn.style.display = canViewJuridico ? 'inline-block' : 'none';
        } else if (sec === 'Comercial') {
          btn.style.display = canViewComercial ? 'inline-block' : 'none';
        }
      });

      const activeBtn = document.querySelector(`#sector-tabs .tab-btn[data-sector="${currentSector}"]`);
      if (currentSector !== 'Todos' && (!activeBtn || activeBtn.style.display === 'none')) {
        const prevSector = currentSector;
        if (isPaFixaOnly) currentSector = 'PA FIXA';
        else if (canViewJunior) currentSector = 'Junior';
        else if (canViewSenior) currentSector = 'Senior';
        else if (canViewPA1 || canViewPA2) currentSector = 'PA FIXA';
        else if (canViewPesquisa) currentSector = 'Pesquisa';
        else if (canViewJuridico) currentSector = 'Juridico';
        else if (canViewComercial) currentSector = 'Comercial';
        else currentSector = 'PA FIXA';
        
        persistCurrentSector();

        if (prevSector !== currentSector && devicesData && devicesData.length > 0) {
          renderDevices();
        }
      }
    } else {
      document.querySelectorAll('#sector-tabs .tab-btn').forEach(btn => {
        if (btn.id !== 'tab-all' || hasGlobalTabs) {
          btn.style.display = 'inline-block';
        }
      });
    }

    // Controlar a visibilidade das choices do split button PA FIXA
    const p1Choice = document.querySelector('.split-choice[data-subsector="PA FIXA 1"]');
    const p2Choice = document.querySelector('.split-choice[data-subsector="PA FIXA 2"]');
    
    if (!hasGlobalTabs) {
      const perms = Array.isArray(currentUser ? currentUser.sectorPermissions : []) ? currentUser.sectorPermissions : [];
      const canViewPA1 = isPaFixaOnly || perms.some(p => p.sector === 'PA FIXA 1' && p.can_view === 1);
      const canViewPA2 = isPaFixaOnly || perms.some(p => p.sector === 'PA FIXA 2' && p.can_view === 1);
      
      if (p1Choice) p1Choice.style.display = canViewPA1 ? 'flex' : 'none';
      if (p2Choice) p2Choice.style.display = canViewPA2 ? 'flex' : 'none';
      
      if (currentSector === 'PA FIXA') {
        if (currentSubSector === 'PA FIXA 1' && !canViewPA1) {
          currentSubSector = 'PA FIXA 2';
          persistCurrentSector();
        } else if (currentSubSector === 'PA FIXA 2' && !canViewPA2) {
          currentSubSector = 'PA FIXA 1';
          persistCurrentSector();
        }
      }
      if (!canViewPA1 && !canViewPA2 && currentSector === 'PA FIXA') {
        currentSubSector = 'PA FIXA 1';
      }
    } else {
      if (p1Choice) p1Choice.style.display = 'flex';
      if (p2Choice) p2Choice.style.display = 'flex';
    }

    // Sincroniza visualmente as abas ativas
    syncSectorTabsUI();
  }


  function setupReadonlyMode() {
    if (currentUser) {
      const isReadonly = currentUser.isReadonly === 1 || currentUser.isReadonly === true;
      const btnOpenAddDevice = document.getElementById('btn-open-add-device');
      const btnOpenLogs = document.getElementById('btn-open-logs');
      
      const canConfigAtLeastOne = availableSectors.some(sec => canConfigureSector(sec));
      const allowEdit = currentUser.username === 'vicenzzo' || currentUser.allowEditDevices === true || currentUser.allowEditDevices === 1;
      
      if (isReadonly || !canConfigAtLeastOne || !allowEdit) {
        if (btnOpenAddDevice) btnOpenAddDevice.style.display = 'none';
      } else {
        if (btnOpenAddDevice) btnOpenAddDevice.style.display = 'inline-block';
      }

      if (isReadonly) {
        if (btnOpenLogs) btnOpenLogs.style.display = 'none';
        if (btnOpenDashboard) btnOpenDashboard.style.display = 'none';
        if (userDisplayName) {
          userDisplayName.classList.remove('admin-user-link');
          userDisplayName.removeAttribute('title');
        }
      } else {
        if (btnOpenLogs) btnOpenLogs.style.display = 'inline-block';
        if (currentUser && (currentUser.allowDashboard === 1 || currentUser.allowDashboard === true)) {
          if (btnOpenDashboard) btnOpenDashboard.style.display = 'inline-block';
        } else {
          if (btnOpenDashboard) btnOpenDashboard.style.display = 'none';
        }
        if (userDisplayName) {
          userDisplayName.classList.add('admin-user-link');
          const canManage = currentUser.username === 'vicenzzo' || currentUser.allowManageUsers === true || currentUser.allowManageUsers === 1;
          userDisplayName.title = canManage 
            ? 'Clique para gerenciar gestores e colaboradores' 
            : 'Clique para gerenciar colaboradores';
        }
      }
    }
  }

  // --- Auto-recuperação de permissões (anti "sessão congelada") ---
  // Revalida periodicamente o estado real do usuário no servidor. Se o nível de
  // acesso foi alterado por um administrador (mesmo sem eventos WebSocket), a UI
  // se ajusta sozinha: evita o caso de gestor aparecendo/bloqueado como visualizador.
  async function refreshCurrentUser() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!data.loggedIn) return;
      const serverUser = data.user;
      if (!currentUser) {
        currentUser = serverUser;
        return;
      }

      const changed =
        (serverUser.isReadonly ? 1 : 0) !== (currentUser.isReadonly ? 1 : 0) ||
        !!serverUser.allowEditDevices !== !!currentUser.allowEditDevices ||
        !!serverUser.allowManageUsers !== !!currentUser.allowManageUsers ||
        (serverUser.allowDashboard ? 1 : 0) !== (currentUser.allowDashboard ? 1 : 0) ||
        !!serverUser.allowAllTabs !== !!currentUser.allowAllTabs ||
        serverUser.name !== currentUser.name ||
        JSON.stringify(serverUser.sectorPermissions || []) !== JSON.stringify(currentUser.sectorPermissions || []);

      if (!changed) return;

      const wasAbleToManageUsers = currentUser.username === 'vicenzzo' || currentUser.allowManageUsers === 1 || currentUser.allowManageUsers === true;
      currentUser = serverUser;

      updateAllTabsVisibility();
      setupReadonlyMode();
      renderDevices();

      if (modalManageUsers && modalManageUsers.classList.contains('open')) {
        const canManageUsers = serverUser.username === 'vicenzzo' || serverUser.allowManageUsers === 1 || serverUser.allowManageUsers === true;
        if (canManageUsers !== wasAbleToManageUsers) {
          const tabUsers = document.querySelector('#manage-users-tabs .tab-btn[data-manage-tab="users"]');
          if (tabUsers) tabUsers.style.display = canManageUsers ? 'inline-block' : 'none';
          if (!canManageUsers) {
            document.querySelectorAll('#manage-users-tabs .tab-btn').forEach(b => {
              if (b.getAttribute('data-manage-tab') === 'collaborators') b.classList.add('active');
              else b.classList.remove('active');
            });
            document.getElementById('manage-users-section-users').style.display = 'none';
            document.getElementById('manage-users-section-collaborators').style.display = 'block';
          }
        }
      }
    } catch (err) {
      // Silencioso: falha pontual de rede não deve quebrar a interface
    }
  }

  // --- Autenticação Inicial ---
  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data.loggedIn) {
        if (window.self !== window.top) {
          setTimeout(checkAuth, 1000);
          return;
        }
        window.location.href = window.location.pathname.startsWith('/crm') ? '/crm/login.html' : './login.html';
        return;
      }
      currentUser = data.user;
      userDisplayName.textContent = currentUser.name;

      if (isRestrictedPaFixaUser(currentUser)) {
        currentUser.allowAllTabs = 0;
        currentSector = 'PA FIXA';
        if (currentSubSector !== 'PA FIXA 1' && currentSubSector !== 'PA FIXA 2') {
          currentSubSector = 'PA FIXA 1';
        }
        persistCurrentSector();
      }
      
      // Habilitar gerenciamento de gestores para qualquer gestor não-readonly
      const isReadonly = currentUser.isReadonly === 1 || currentUser.isReadonly === true;
      if (!isReadonly) {
        userDisplayName.classList.add('admin-user-link');
        userDisplayName.addEventListener('click', openManageUsersModal);
        
        if (currentUser.username === 'vicenzzo') {
          const tabSystemUpdate = document.getElementById('tab-system-update');
          if (tabSystemUpdate) tabSystemUpdate.style.display = 'inline-block';
        }
      }
      
      setupReadonlyMode();
      await loadSystemUsersList();
      
      // Solicitar permissão para notificações do Windows
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
      
      // Escutar mensagens de confirmação vindas do popup de alarme
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'ALARM_CONFIRMED' && event.data.numberId) {
          const nId = parseInt(event.data.numberId);
          if (nId) {
            sendWSMessage('CONFIRM_RELEASE', { numberId: nId, versao: getNumberVersion(nId) });
            notifiedAlarms.delete(nId);
            delete openAlarmPopups[nId];
          }
        }
      });
      
      updateAllTabsVisibility();
      populateChatSectors();
      
      // Conectar ao WebSocket após confirmar login
      connectWebSocket();

      // Revalidar permissões periodicamente (auto-recuperação de nível de acesso)
      setInterval(refreshCurrentUser, 30000);
    } catch (err) {
      console.error('Erro na autenticação:', err);
      if (window.self !== window.top) {
        setTimeout(checkAuth, 1500);
        return;
      }
      window.location.href = window.location.pathname.startsWith('/crm') ? '/crm/login.html' : './login.html';
    }
  }

  function triggerSystemNotification(title, body, tag) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          tag: tag,
          icon: '/favicon.ico'
        });
      } catch (err) {
        console.error('Erro ao exibir notificação do sistema:', err);
      }
    }
  }

  // --- WebSocket ---
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const tokenQuery = ssoToken ? `?sso_token=${encodeURIComponent(ssoToken)}` : '';
    const wsUrl = `${protocol}//${window.location.host}${tokenQuery}`;
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      connectionStatus.textContent = 'Online';
      connectionStatus.className = 'conn-status online';
      refreshCurrentUser();
    };

    socket.onclose = () => {
      connectionStatus.textContent = 'Desconectado';
      connectionStatus.className = 'conn-status offline';
      // Tentar reconectar após 3 segundos
      setTimeout(connectWebSocket, 3000);
    };

    socket.onerror = (err) => {
      console.error('Erro no WebSocket:', err);
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'FULL_STATE':
            devicesData = message.data;
            updateAllTabsVisibility();
            renderDevices();
            break;
          case 'LOGS_UPDATE':
            logsData = message.data;
            updateLogManagerFilterOptions();
            renderLogs();
            break;
          case 'DELTA_UPDATE':
            const { event: deltaEvent, payload: deltaPayload } = message.data;
            handleDeltaUpdate(deltaEvent, deltaPayload);
            break;
          case 'PERMISSION_UPDATE':
            if (currentUser) {
              currentUser.allowAllTabs = message.data.allowAllTabs;
              updateAllTabsVisibility();
            }
            break;
          case 'ROLE_UPDATE':
            if (currentUser) {
              currentUser.isReadonly = message.data.isReadonly;
              setupReadonlyMode();
              renderDevices();
            }
            break;
          case 'EDIT_DEVICES_UPDATE':
            if (currentUser) {
              currentUser.allowEditDevices = message.data.allowEditDevices;
              setupReadonlyMode();
              renderDevices();
            }
            break;
          case 'MANAGE_USERS_UPDATE':
            if (currentUser) {
              currentUser.allowManageUsers = message.data.allowManageUsers;
              setupReadonlyMode();
              if (modalManageUsers && modalManageUsers.classList.contains('open')) {
                const canManage = currentUser.username === 'vicenzzo' || currentUser.allowManageUsers === true || currentUser.allowManageUsers === 1;
                const tabUsers = document.querySelector('#manage-users-tabs .tab-btn[data-manage-tab="users"]');
                if (tabUsers) tabUsers.style.display = canManage ? 'inline-block' : 'none';
                if (!canManage) {
                  document.querySelectorAll('#manage-users-tabs .tab-btn').forEach(b => {
                    if (b.getAttribute('data-manage-tab') === 'collaborators') b.classList.add('active');
                    else b.classList.remove('active');
                  });
                  document.getElementById('manage-users-section-users').style.display = 'none';
                  document.getElementById('manage-users-section-collaborators').style.display = 'block';
                }
              }
            }
            break;
          case 'ACTIVE_UPDATE':
            if (currentUser && message.data.isActive === 0) {
              alert('Sua conta foi desativada pelo administrador. Você será desconectado.');
              window.location.href = '/login.html';
            }
            break;
          case 'SECTOR_PERMISSIONS_UPDATE':
            if (currentUser) {
              const meRes = await fetch('/api/auth/me');
              const meData = await meRes.json();
              if (meData.loggedIn) {
                currentUser = meData.user;
                updateAllTabsVisibility();
                setupReadonlyMode();
                renderDevices();
                showToast('Seus acessos de setores foram atualizados!');
              }
            }
            break;
          case 'PONG':
            const pongTime = Date.now();
            const latency = pongTime - message.timestamp;
            if (wsLatency) {
              wsLatency.textContent = `Latência: ${latency} ms`;
            }
            break;
          case 'DASHBOARD_DATA':
            updateAgentTelemetry(message.data);
            break;
          case 'DASHBOARD_UPDATE':
            if (currentUser) {
              currentUser.allowDashboard = message.data.allowDashboard;
              setupReadonlyMode();
              if (currentUser.allowDashboard !== 1 && currentUser.allowDashboard !== true) {
                if (modalDashboard && modalDashboard.classList.contains('active')) {
                  closeModal(modalDashboard);
                }
              }
            }
            break;
          case 'ERROR':
            alert(message.message || 'Ocorreu um erro no servidor.');
            break;
          case 'CHAT_HISTORY':
            if (message.data && message.data.sector) {
              chatHistoryBySector[message.data.sector] = message.data.messages || [];
              if (currentChatSector === message.data.sector && chatPanelOpen) {
                renderChatMessages();
              }
            }
            break;
        }
      } catch (err) {
        console.error('Erro ao processar mensagem WebSocket:', err);
      }
    };
  }

  function sendWSMessage(type, payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    } else {
      alert('Conexão perdida com o servidor. Tente recarregar a página.');
    }
  }

  function getNumberVersion(numberId) {
    if (!devicesData) return 0;
    const numIdInt = parseInt(numberId);
    for (const d of devicesData) {
      if (d.numbers) {
        const n = d.numbers.find(num => num.id === numIdInt);
        if (n) return n.versao || 0;
      }
    }
    return 0;
  }

  // --- CHAT FLUTUANTE DA EQUIPE ---

  function canViewChatSector(sector) {
    if (!currentUser) return true;
    if (currentUser.username === 'vicenzzo') return true;
    if (currentUser.sectorPermissions && currentUser.sectorPermissions.length > 0) {
      if (sector === 'Todos') return currentUser.allowAllTabs === 1 || currentUser.allowAllTabs === true;
      const perm = currentUser.sectorPermissions.find(p => p.sector === sector);
      return perm ? perm.can_view === 1 : false;
    }
    return true;
  }

  function populateChatSectors() {
    if (!chatSectorSelect) return;
    const previous = currentChatSector;
    const visibleSectors = availableSectors.filter(canViewChatSector);
    chatSectorSelect.innerHTML = '';
    visibleSectors.forEach(sector => {
      const opt = document.createElement('option');
      opt.value = sector;
      opt.textContent = sector;
      chatSectorSelect.appendChild(opt);
    });

    if (chatSenderSelect) {
      const currentName = currentUser ? currentUser.name : '';
      chatSenderSelect.innerHTML = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = currentName;
      defaultOpt.textContent = currentName || 'Selecione o remetente';
      chatSenderSelect.appendChild(defaultOpt);
      systemUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name;
        opt.textContent = u.name;
        chatSenderSelect.appendChild(opt);
      });
    }

    if (visibleSectors.length > 0) {
      if (previous && visibleSectors.includes(previous)) {
        currentChatSector = previous;
      } else {
        currentChatSector = visibleSectors[0];
      }
      chatSectorSelect.value = currentChatSector;
    } else {
      currentChatSector = null;
    }
  }

  function renderChatMessages() {
    if (!chatMessagesEl) return;
    const messages = chatHistoryBySector[currentChatSector] || [];
    if (messages.length === 0) {
      chatMessagesEl.innerHTML = '<div class="chat-empty">Nenhuma mensagem neste setor. Seja o primeiro a enviar!</div>';
      return;
    }
    const currentName = currentUser ? currentUser.name : '';
    const html = messages.map(msg => {
      const isOwn = String(msg.sender).toLowerCase().trim() === String(currentName).toLowerCase().trim();
      const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="chat-msg${isOwn ? ' chat-msg-own' : ''}">
          <div class="chat-msg-meta">
            <span class="chat-msg-sender" title="${escapeHTML(msg.sender)}">${escapeHTML(msg.sender)}</span>
            <span class="chat-msg-time">${escapeHTML(time)}</span>
          </div>
          <div class="chat-msg-bubble">${escapeHTML(msg.message)}</div>
        </div>
      `;
    }).join('');
    chatMessagesEl.innerHTML = html;
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function updateChatFabBadge() {
    if (!chatFabBadge) return;
    const total = Object.values(chatUnreadBySector).reduce((a, b) => a + (b || 0), 0);
    chatFabBadge.textContent = total > 99 ? '99+' : String(total);
    chatFabBadge.style.display = total > 0 ? 'flex' : 'none';
  }

  function handleIncomingChatMessage(chatMessage) {
    const sector = chatMessage.sector;
    if (!sector) return;
    if (!chatHistoryBySector[sector]) chatHistoryBySector[sector] = [];
    chatHistoryBySector[sector].push(chatMessage);

    if (chatPanelOpen && currentChatSector === sector) {
      renderChatMessages();
    } else {
      chatUnreadBySector[sector] = (chatUnreadBySector[sector] || 0) + 1;
      updateChatFabBadge();
    }
  }

  function loadChatHistory(sector) {
    if (!sector) return;
    sendWSMessage('GET_CHAT_HISTORY', { sector });
  }

  function openChatPanel() {
    if (!chatPanel) return;
    if (!chatSectorSelect || chatSectorSelect.options.length === 0) {
      populateChatSectors();
    }
    chatPanelOpen = true;
    chatPanel.style.display = 'flex';
    if (chatUnreadBySector[currentChatSector]) {
      chatUnreadBySector[currentChatSector] = 0;
      updateChatFabBadge();
    }
    loadChatHistory(currentChatSector);
    if (chatInput) chatInput.focus();
  }

  function closeChatPanel() {
    if (!chatPanel) return;
    chatPanelOpen = false;
    chatPanel.style.display = 'none';
  }

  function sendChatMessage() {
    const text = chatInput ? chatInput.value : '';
    if (!text || !text.trim()) return;
    const sender = chatSenderSelect ? chatSenderSelect.value : (currentUser ? currentUser.name : '');
    if (!sender) {
      alert('Selecione qual usuário você está representando.');
      return;
    }
    if (!currentChatSector) {
      alert('Nenhum setor de chat disponível.');
      return;
    }
    sendWSMessage('SEND_CHAT_MESSAGE', { sector: currentChatSector, sender, message: text.trim() });
    chatInput.value = '';
    chatInput.focus();
  }

  if (chatFab) {
    chatFab.addEventListener('click', () => {
      if (chatPanelOpen) {
        closeChatPanel();
      } else {
        openChatPanel();
      }
    });
  }
  if (chatCloseBtn) {
    chatCloseBtn.addEventListener('click', closeChatPanel);
  }
  if (chatSectorSelect) {
    chatSectorSelect.addEventListener('change', () => {
      const sector = chatSectorSelect.value;
      if (!sector) return;
      currentChatSector = sector;
      chatUnreadBySector[sector] = 0;
      updateChatFabBadge();
      chatMessagesEl.innerHTML = '<div class="chat-empty">Carregando mensagens...</div>';
      loadChatHistory(sector);
    });
  }
  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendChatMessage);
  }
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  function handleDeltaUpdate(event, payload) {
    switch (event) {
      case 'NUMBER_ADDED': {
        const dev = devicesData.find(d => d.id === payload.device_id);
        if (dev) {
          if (!dev.numbers) dev.numbers = [];
          if (!dev.numbers.some(n => n.id === payload.id)) {
            dev.numbers.push(payload);
          }
          renderDevices();
        }
        break;
      }
      case 'NUMBER_UPDATED': {
        let found = false;
        devicesData.forEach(d => {
          if (d.numbers) {
            const index = d.numbers.findIndex(n => n.id === payload.id);
            if (index !== -1) {
              found = true;
              if (payload.device_id !== d.id) {
                d.numbers.splice(index, 1);
                const newDev = devicesData.find(nd => nd.id === payload.device_id);
                if (newDev) {
                  if (!newDev.numbers) newDev.numbers = [];
                  newDev.numbers.push(payload);
                }
              } else {
                d.numbers[index] = payload;
              }
            }
          }
        });
        
        if (!found) {
          const dev = devicesData.find(d => d.id === payload.device_id);
          if (dev) {
            if (!dev.numbers) dev.numbers = [];
            dev.numbers.push(payload);
          }
        }
        
        renderDevices();
        break;
      }
      case 'NUMBER_DELETED': {
        devicesData.forEach(d => {
          if (d.numbers) {
            const index = d.numbers.findIndex(n => n.id === payload.id);
            if (index !== -1) {
              d.numbers.splice(index, 1);
            }
          }
        });
        renderDevices();
        break;
      }
      case 'DEVICE_ADDED': {
        if (!devicesData.some(d => d.id === payload.id)) {
          payload.numbers = [];
          devicesData.push(payload);
        }
        renderDevices();
        break;
      }
      case 'DEVICE_UPDATED': {
        const dev = devicesData.find(d => d.id === payload.id);
        if (dev) {
          dev.name = payload.name;
          dev.sector = payload.sector;
          renderDevices();
        }
        break;
      }
      case 'DEVICE_DELETED': {
        const index = devicesData.findIndex(d => d.id === payload.id);
        if (index !== -1) {
          devicesData.splice(index, 1);
        }
        renderDevices();
        break;
      }
      case 'LOG_ADDED': {
        const { type, log } = payload;
        if (logsData && logsData[type]) {
          logsData[type].unshift(log);
          if (logsData[type].length > 200) {
            logsData[type].pop();
          }
          updateLogManagerFilterOptions();
          renderLogs();
        }
        break;
      }
      case 'COLLABORATOR_ADDED': {
        if (!systemUsers.some(u => u.id === payload.id)) {
          systemUsers.push(payload);
        }
        break;
      }
      case 'COLLABORATOR_UPDATED': {
        const idx = systemUsers.findIndex(u => u.id === payload.id);
        if (idx !== -1) {
          systemUsers[idx] = payload;
        }
        break;
      }
      case 'COLLABORATOR_DELETED': {
        const idx = systemUsers.findIndex(u => u.id === payload.id);
        if (idx !== -1) {
          systemUsers.splice(idx, 1);
        }
        break;
      }
      case 'AGENT_STATUS_UPDATE':
        updateAgentTelemetry(payload);
        break;
      case 'NUMBER_VERITAS_STATUS_DELTA': {
        const { updatedNumbers } = payload;
        if (Array.isArray(updatedNumbers)) {
          let hasChanges = false;
          updatedNumbers.forEach(upd => {
            devicesData.forEach(d => {
              if (d.numbers) {
                const n = d.numbers.find(num => num.id === upd.id);
                if (n) {
                  n.veritas_status = upd.veritasStatus;
                  n.veritas_last_seen = upd.veritasLastSeen;
                  n.veritas_name = upd.veritasName;
                  hasChanges = true;
                }
              }
            });
          });
          if (hasChanges) {
            renderDevices();
          }
        }
        break;
      }
      case 'EVT_MESSAGE_SENT_DELTA':
        updateThroughputData(payload);
        break;
      case 'CHAT_MESSAGE_ADDED':
        if (payload && payload.chatMessage) {
          handleIncomingChatMessage(payload.chatMessage);
        }
        break;
    }
  }

  // --- Determinar gênero com base no nome (heurística para português do Brasil) ---
  function getGenderByName(name) {
    if (!name) return 'male';
    const firstName = name.trim().split(' ')[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Nomes femininos comuns que não terminam em 'a' ou com terminações diferentes
    const femaleNames = [
      'beatriz', 'alice', 'iris', 'isabel', 'yasmin', 'raquel', 'ruth', 'ester', 'esther', 
      'carol', 'caroline', 'caroliny', 'ellen', 'helen', 'ingrid', 'vivian', 'marlene', 'elisete',
      'solange', 'cleide', 'lourdes', 'nair', 'sueli', 'suely', 'rosangela', 'elisangela', 'elizabeth',
      'carmen', 'miriam', 'neli', 'nely', 'suzy', 'mari'
    ];
    
    // Nomes masculinos comuns que terminam em 'a'
    const maleNames = [
      'luca', 'lucas', 'natan', 'alan', 'ian', 'jean', 'jonas', 'matias', 'messias', 'elias',
      'josue', 'andre', 'felipe', 'alexandre', 'guilherme', 'henrique', 'luis', 'luiz',
      'igor', 'artur', 'arthur', 'heitor', 'vitor', 'victor', 'gabriel', 'rafael', 'daniel', 'samuel',
      'miguel', 'davi', 'david', 'murilo', 'otavio', 'gustavo', 'caio', 'enzo', 'thiago', 'tiago',
      'paulo', 'ricardo', 'rodrigo', 'fernando', 'marcos', 'mateus', 'matheus'
    ];

    if (femaleNames.includes(firstName)) return 'female';
    if (maleNames.includes(firstName)) return 'male';
    
    // Regra geral para nomes terminados em 'a' serem femininos
    if (firstName.endsWith('a')) {
      return 'female';
    }
    
    // Padrão masculino para outros
    return 'male';
  }

  // --- Retornar avatar SVG colorido baseado no gênero ---
  function getAvatarSvg(gender) {
    if (gender === 'female') {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
        <defs>
          <linearGradient id="femGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4a3e4d" />
            <stop offset="100%" stop-color="#2d2430" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="16" fill="url(#femGrad)" />
        <path d="M16 6c-4.4 0-8 3.6-8 8v4c0 1.5.5 3 1.5 4.2.3-.8.8-1.5 1.5-2V14c0-3.3 2.7-6 6-6s6 2.7 6 6v4.2c.7.5 1.2 1.2 1.5 2 1-1.2 1.5-2.7 1.5-4.2V14c0-4.4-3.6-8-8-8z" fill="#1e1e24" opacity="0.3"/>
        <circle cx="16" cy="15" r="5" fill="#e2c4a8" />
        <path d="M16 6c-3.3 0-6 2.7-6 6v1c1 0 2-1 3-2 1 1 2 2 3 2s2-1 3-2c1 1 2 2 3 2v-1c0-3.3-2.7-6-6-6z" fill="#1e1e24" />
        <path d="M16 21c-4.4 0-8 2.5-8 5v1h16v-1c0-2.5-3.6-5-8-5z" fill="#5c4d5e" />
      </svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
        <defs>
          <linearGradient id="maleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3a4146" />
            <stop offset="100%" stop-color="#1e2225" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="16" fill="url(#maleGrad)" />
        <path d="M16 6c-4 0-7 2.5-7 6v2c0 1 .5 2 1 2.5V14c0-3 2.5-5 6-5s6 2 6 5v2.5c.5-.5 1-1.5 1-2.5v-2c0-3.5-3-6-7-6z" fill="#181a1b" opacity="0.3"/>
        <circle cx="16" cy="15" r="5" fill="#e2c4a8" />
        <path d="M16 6c-3 0-5 2-5 4.5s1 .5 2 1c1-1 2-1.5 3-1.5s2 .5 3 1.5c1-.5 2-1 2-1S20 8.5 19 8c-1-1-2-2-3-2z" fill="#181a1b" />
        <path d="M16 21c-4.4 0-8 2.5-8 5v1h16v-1c0-2.5-3.6-5-8-5z" fill="#464e54" />
      </svg>`;
    }
  }

  // --- Auxiliares para resolução e comparação precisa de colaboradores ---
  function findCollaboratorInSystem(name) {
    if (!name) return null;
    const nameLower = name.toLowerCase().trim();

    // 1) Match exact
    let colab = systemUsers.find(u => u.name.toLowerCase().trim() === nameLower);
    if (colab) return colab;

    // 2) Match startsWith (ex: "Vinicius" -> "Vinicius Correia")
    colab = systemUsers.find(u => u.name.toLowerCase().trim().startsWith(nameLower));
    if (colab) return colab;

    // 3) Match if the chip/search name contains the collaborator's full name (ex: "Leticia Cordeiro Reserva" -> "Leticia Cordeiro")
    colab = systemUsers.find(u => {
      const uName = u.name.toLowerCase().trim();
      return uName.length > 3 && nameLower.includes(uName);
    });
    if (colab) return colab;

    // 4) Match if the collaborator's name contains the search name (ex: "Leticia" -> "Leticia Cordeiro")
    colab = systemUsers.find(u => {
      const uName = u.name.toLowerCase().trim();
      return nameLower.length > 3 && uName.includes(nameLower);
    });
    if (colab) return colab;

    // 5) Match first name / first word (ex: "Andianara Reserva" -> "ANDIANARA TAIS RAUTTA")
    const searchFirstWord = nameLower.split(' ')[0];
    const ignoreWords = ['reserva', 'pesquisa', 'pa', 'fixa', 'backoffice', 'sem'];
    if (searchFirstWord && !ignoreWords.includes(searchFirstWord)) {
      colab = systemUsers.find(u => {
        const uFirstWord = u.name.split(' ')[0].toLowerCase().trim();
        return uFirstWord === searchFirstWord;
      });
      if (colab) return colab;
    }

    return null;
  }

  function resolveToCollaboratorName(name) {
    const colab = findCollaboratorInSystem(name);
    return colab ? colab.name : null;
  }

  function matchCollaboratorNames(name1, name2) {
    if (!name1 || !name2) return false;
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    if (n1 === n2) return true;

    const resolved1 = resolveToCollaboratorName(n1);
    const resolved2 = resolveToCollaboratorName(n2);

    if (resolved1 && resolved2) {
      return resolved1.toLowerCase().trim() === resolved2.toLowerCase().trim();
    }

    if (resolved1 || resolved2) {
      return false;
    }

    return n1.includes(n2) || n2.includes(n1);
  }

  function isDeviceSectorMatch(deviceSector, targetSector, targetSubSector) {
    if (targetSector === 'Todos') return true;
    if (targetSector === 'PA FIXA') {
      if (targetSubSector === 'Ver Ambos') {
        return deviceSector === 'PA FIXA 1' || deviceSector === 'PA FIXA 2';
      }
      return deviceSector === targetSubSector;
    }
    return deviceSector === targetSector;
  }

  function isNumberMatchSector(device, num, targetSector, targetSubSector) {
    if (targetSector === 'Todos') return true;

    const isReserva = device.name.toLowerCase().includes('reserva') || (num.name && num.name.toLowerCase().includes('reserva'));

    if (isReserva) {
      const holders = holderLists.get(num.id) || [];
      if (holders.length > 0) {
        return holders.some(h => {
          const colab = findCollaboratorInSystem(h);
          if (!colab) return false;
          if (targetSector === 'PA FIXA') {
            if (targetSubSector === 'Ver Ambos') {
              return colab.sector === 'PA FIXA 1' || colab.sector === 'PA FIXA 2';
            }
            return colab.sector === targetSubSector;
          }
          return colab.sector === targetSector;
        });
      } else {
        return isDeviceSectorMatch(device.origin_sector || device.sector, targetSector, targetSubSector);
      }
    } else {
      const negotiatorName = getNegotiatorName(device, num);
      const colab = findCollaboratorInSystem(negotiatorName);
      if (colab) {
        if (targetSector === 'PA FIXA') {
          if (targetSubSector === 'Ver Ambos') {
            return colab.sector === 'PA FIXA 1' || colab.sector === 'PA FIXA 2';
          }
          return colab.sector === targetSubSector;
        }
        return colab.sector === targetSector;
      } else {
        return isDeviceSectorMatch(device.origin_sector || device.sector, targetSector, targetSubSector);
      }
    }
  }

  // --- Obter o nome do negociador associado a um chip ---
  function getNegotiatorName(device, num) {
    let checkNames = [];
    if (num && num.name) checkNames.push(num.name);
    if (device && device.name) checkNames.push(device.name);

    for (const rawName of checkNames) {
      const resolved = resolveToCollaboratorName(rawName);
      if (resolved) return resolved;
    }

    return num ? (num.name || '') : (device ? (device.name || '') : '');
  }

  function isPrincipalLivre(holderName) {
    if (!holderName) return false;
    const nameLower = holderName.toLowerCase();
    
    for (const device of devicesData) {
      const isDeviceReserva = device.name.toLowerCase().includes('reserva');
      
      if (device.numbers) {
        for (const num of device.numbers) {
          const isNumReserva = num.name.toLowerCase().includes('reserva');
          
          if (!isDeviceReserva && !isNumReserva) {
            const nameMatches = (num.name && num.name.toLowerCase() === nameLower) || 
                                (device.name && device.name.toLowerCase() === nameLower);
            
            if (nameMatches && num.status === 'Livre') {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  // --- Status do VERITAS (Bolinhas indicadoras, sem texto) ---
  // 🟢 Online / Operante (CONNECTED no Veritas com ping ativo)
  // 🟡 Aguardando QR Code / Conectando (PAIRING / OPENING)
  // 🔴 Desconectado (DISCONNECTED no Veritas)
  // ⚪ Não cadastrado no VERITAS
  function renderVeritasDot(n) {
    if (!n) return '<span class="veritas-dot dot-not-registered" title="⚪ Não cadastrado no VERITAS"></span>';

    const rawStatus = String(n.veritas_status || '').toUpperCase().trim();
    let timeStr = '';
    if (n.veritas_last_seen) {
      try {
        const d = new Date(n.veritas_last_seen);
        timeStr = ` • Visto às ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      } catch(e) {}
    }

    if (rawStatus === 'CONNECTED') {
      return `<span class="veritas-dot dot-online" title="🟢 Online / Operante (VERITAS)${timeStr}"></span>`;
    } else if (rawStatus === 'PAIRING' || rawStatus === 'OPENING' || rawStatus === 'QRCODE') {
      return `<span class="veritas-dot dot-waiting" title="🟡 Aguardando QR Code / Conectando (VERITAS)${timeStr}"></span>`;
    } else if (rawStatus === 'DISCONNECTED' || rawStatus === 'TIMEOUT' || rawStatus === 'CONFLICT') {
      return `<span class="veritas-dot dot-disconnected" title="🔴 Desconectado (VERITAS)${timeStr}"></span>`;
    } else {
      return `<span class="veritas-dot dot-not-registered" title="⚪ Não cadastrado no VERITAS"></span>`;
    }
  }

  // --- Renderização de Dispositivos e Números ---
  function renderDevices() {
    // Build holder chip count map and holder chips map
    const holderChipCount = new Map();
    holderChips.clear();
    holderLists.clear();
    devicesData.forEach(device => {
      if (device.numbers) {
        device.numbers.forEach(num => {
          const holders = num.holder ? String(num.holder).split(',').map(h => h.trim()).filter(Boolean) : [];
          holderLists.set(num.id, holders);

          if (num.holder) {
            const holders = String(num.holder).split(',').map(h => h.trim()).filter(Boolean);
            holders.forEach(holder => {
              const count = holderChipCount.get(holder) || 0;
              holderChipCount.set(holder, count + 1);

              // Add to holderChips map
              if (!holderChips.has(holder)) {
                holderChips.set(holder, []);
              }
              holderChips.get(holder).push({
                deviceName: device.name,
                chipName: num.name || 'Sem identificador',
                numberId: num.id
              });
            });
          }
        });
      }
    });

    // Construir mapa: holder de reserva -> array de infos da reserva
    const reservaHolderMap = {}; // name -> Array of { last4, deviceName, chipName, numberId }
    for (const d of devicesData) {
      if (d.numbers) {
        for (const n of d.numbers) {
          if (n.holder && n.holder.trim()) {
            const negotiatorName = getNegotiatorName(d, n);
            const negotiatorNameLower = negotiatorName ? negotiatorName.toLowerCase().trim() : '';
            const last4 = n.phone_number.replace(/\D/g, '').slice(-4);
            const holdersOfReserve = n.holder.split(',').map(h => h.trim()).filter(Boolean);
            
            holdersOfReserve.forEach(hName => {
              const hNameLower = hName.toLowerCase().trim();
              
              // Se o responsável não for o próprio negociador principal, ele está cobrindo o chip
              if (hNameLower !== negotiatorNameLower) {
                if (!reservaHolderMap[hNameLower]) {
                  reservaHolderMap[hNameLower] = [];
                }
                reservaHolderMap[hNameLower].push({
                  last4,
                  deviceName: d.name,
                  chipName: n.name || 'Sem identificador',
                  numberId: n.id
                });
              }
            });
          }
        }
      }
    }

    // Identificar negociadores restritos e sem reserva por setor
    const restrictedWithoutReserveBySector = {
      'Junior': [],
      'Senior': [],
      'PA FIXA 1': [],
      'PA FIXA 2': [],
      'Pesquisa': [],
      'Juridico': [],
      'Comercial': [],
      'Todos': []
    };

    for (const d of devicesData) {
      const deviceIsReserva = d.name.toLowerCase().includes('reserva');
      if (d.numbers) {
        for (const n of d.numbers) {
          const numIsReserva = n.name.toLowerCase().includes('reserva');
          // Deve ser chip principal (não-reserva) e estar com status restrito ou banido
          if (!deviceIsReserva && !numIsReserva && (n.status.startsWith('Restrito') || n.status === 'Banido')) {
            const negotiatorName = getNegotiatorName(d, n);
            if (negotiatorName) {
              const negotiatorNameLower = negotiatorName.toLowerCase().trim();

              // Check if this negotiator has any reserve chip allocated
              let hasReserve = false;
              for (const key of Object.keys(reservaHolderMap)) {
                const keyLower = key.toLowerCase().trim();
                if (matchCollaboratorNames(negotiatorNameLower, keyLower)) {
                  hasReserve = true;
                  break;
                }
              }
              if (!hasReserve) {
                const colab = findCollaboratorInSystem(negotiatorName);
                let tabSector = (colab && colab.sector) ? colab.sector : d.sector;
                const info = {
                  name: negotiatorName,
                  gender: getGenderByName(negotiatorName),
                  numberId: n.id
                };

                // Normalização se o setor vier como 'PA FIXA' genérico
                if (tabSector === 'PA FIXA') {
                  const numDevSector = d.origin_sector || d.sector;
                  if (numDevSector === 'PA FIXA 1' || numDevSector === 'PA FIXA 2') {
                    tabSector = numDevSector;
                  } else {
                    ['PA FIXA 1', 'PA FIXA 2'].forEach(sub => {
                      if (!restrictedWithoutReserveBySector[sub].some(item => item.name.toLowerCase().trim() === negotiatorNameLower)) {
                        restrictedWithoutReserveBySector[sub].push(info);
                      }
                    });
                  }
                }

                // Adicionar ao setor específico se existir
                if (restrictedWithoutReserveBySector[tabSector]) {
                  if (!restrictedWithoutReserveBySector[tabSector].some(item => item.name.toLowerCase().trim() === negotiatorNameLower)) {
                    restrictedWithoutReserveBySector[tabSector].push(info);
                  }
                }
                // Adicionar a Todos
                if (!restrictedWithoutReserveBySector['Todos'].some(item => item.name.toLowerCase().trim() === negotiatorNameLower)) {
                  restrictedWithoutReserveBySector['Todos'].push(info);
                }
              }
            }
          }
        }
      }
    }

    // Renderizar o Painel Lateral com os balões divididos por setor dinamicamente
    const sidebar = document.getElementById('restricted-sidebar');
    let sectorsToRender = [];

    const isPaFixaOnly = isRestrictedPaFixaUser(currentUser);
    const hasGlobalTabs = !isPaFixaOnly && currentUser && (currentUser.username === 'vicenzzo' || currentUser.allowAllTabs === 1 || currentUser.allowAllTabs === true);

    if (hasGlobalTabs) {
      sectorsToRender = ['Junior', 'Senior', 'PA FIXA 1', 'PA FIXA 2', 'Pesquisa', 'Juridico', 'Comercial'];
    } else if (isPaFixaOnly) {
      sectorsToRender = ['PA FIXA 1', 'PA FIXA 2'];
    } else {
      const perms = Array.isArray(currentUser ? currentUser.sectorPermissions : []) ? currentUser.sectorPermissions : [];
      sectorsToRender = ['Junior', 'Senior', 'PA FIXA 1', 'PA FIXA 2', 'Pesquisa', 'Juridico', 'Comercial'].filter(sec => {
        if (sec === 'PA FIXA 1' || sec === 'PA FIXA 2') {
          return perms.some(p => (p.sector === sec || p.sector === 'PA FIXA') && p.can_view === 1);
        }
        return perms.some(p => p.sector === sec && p.can_view === 1);
      });
      if (sectorsToRender.length === 0) {
        sectorsToRender = [currentSector === 'PA FIXA' ? currentSubSector : currentSector];
      }
    }
    
    const hasAnyRestricted = sectorsToRender.some(sec => restrictedWithoutReserveBySector[sec] && restrictedWithoutReserveBySector[sec].length > 0);

    if (sidebar) {
      const isAnyModalOpen = !!document.querySelector('.modal.active');
      if (hasAnyRestricted) {
        sidebar.style.display = isAnyModalOpen ? 'none' : 'flex';
        let html = '';
        
        sectorsToRender.forEach(sec => {
          const list = restrictedWithoutReserveBySector[sec];
          if (list && list.length > 0) {
            html += `
              <div class="sidebar-sector-block">
                <div class="sidebar-sector-header">${sec}</div>
                <div class="sidebar-balloons-list">
            `;
            
            list.forEach((negociador, index) => {
              // Classe de tamanho decrescente por setor
              let sizeClass = 'size-sm';
              if (index === 0) sizeClass = 'size-lg';
              else if (index === 1) sizeClass = 'size-md';

              const avatarSvg = getAvatarSvg(negociador.gender);
              
              html += `
                <div class="restricted-balloon ${sizeClass}" data-number-id="${negociador.numberId}" title="${negociador.name} está restrito e sem chip de reserva!">
                  <div class="restricted-balloon-avatar">
                    ${avatarSvg}
                  </div>
                  <span class="restricted-balloon-name">${escapeHTML(negociador.name)}</span>
                </div>
              `;
            });
            
            html += `
                </div>
              </div>
            `;
          }
        });
        
        sidebar.innerHTML = html;
      } else {
        sidebar.style.display = 'none';
        sidebar.innerHTML = '';
      }
    }

    devicesContainer.innerHTML = '';
    
    // Filtrar aparelhos pertencentes à aba do setor ativo ou subsetor da PA FIXA
    // E filtrar por busca (searchQuery)
    // E filtrar de acordo com o status selecionado (currentFilter)
    // E filtrar por Apenas Reservas (showOnlyReservas)
    // E ordenar de forma natural robusta (1, 2... 10)
    const filteredDevices = devicesData
      .filter(d => {
        if (currentSector === 'Todos') return true;
        
        // 1. O celular é nativo daquele setor
        const deviceSectorMatches = isDeviceSectorMatch(d.origin_sector || d.sector, currentSector, currentSubSector);
        if (deviceSectorMatches) return true;
        
        // 2. O celular possui algum chip cujo colaborador pertence ao setor ativo
        const hasLinkedUserInSector = d.numbers && d.numbers.some(num => isNumberMatchSector(d, num, currentSector, currentSubSector));
        return hasLinkedUserInSector;
      })
      .filter(d => {
        if (!searchQuery) return true;
        
        const deviceNameMatch = d.name.toLowerCase().includes(searchQuery);
        if (deviceNameMatch) return true;
        
        const isNumericQuery = /^\d+$/.test(searchQuery);
        return d.numbers && d.numbers.some(num => {
          const chipNameMatch = num.name.toLowerCase().includes(searchQuery);
          if (chipNameMatch) return true;
          
          const cleanPhone = num.phone_number.replace(/\D/g, '');
          if (isNumericQuery) {
            return cleanPhone.endsWith(searchQuery) || cleanPhone.includes(searchQuery);
          }
          return cleanPhone.includes(searchQuery);
        });
      })
      .filter(d => {
        // Se o aparelho não tiver números
        if (!d.numbers || d.numbers.length === 0) {
          if (showOnlyReservas) {
            const deviceIsReserva = d.name.toLowerCase().includes('reserva');
            if (!deviceIsReserva) return false;
          }
          return currentFilter === 'all';
        }
        
        // Se tiver números, filtramos os números que passam nas condições ativas simultaneamente
        const matchingNumbers = d.numbers.filter(num => {
          // 0. Validar se atende ao setor ativo (se não for "Todos")
          if (!isNumberMatchSector(d, num, currentSector, currentSubSector)) {
            return false;
          }

          // 1. Validar se atende ao filtro de apenas reservas
          if (showOnlyReservas) {
            const deviceIsReserva = d.name.toLowerCase().includes('reserva');
            const numberIsReserva = num.name && num.name.toLowerCase().includes('reserva');
            if (!deviceIsReserva && !numberIsReserva) return false;
          }
          
          // 2. Validar se atende ao filtro de status
          if (currentFilter === 'free') {
            return num.status === 'Livre';
          }
          if (currentFilter === 'inuse') {
            return num.status === 'Em Uso';
          }
          if (currentFilter === 'restricted') {
            return num.status.startsWith('Restrito');
          }
          if (currentFilter === 'banned') {
            return num.status === 'Banido' || num.status === 'Banido Definitivo';
          }
          
          return true; // 'all'
        });
        
        // Retorna true se houver pelo menos um número que atenda a todos os critérios
        return matchingNumbers.length > 0;
      })
      .sort((a, b) => {
        const numA = parseInt(a.name, 10);
        const numB = parseInt(b.name, 10);
        const isNumA = !isNaN(numA);
        const isNumB = !isNaN(numB);
        
        if (isNumA && isNumB) {
          return numA - numB;
        }
        if (isNumA) return -1;
        if (isNumB) return 1;
        
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

    if (filteredDevices.length === 0) {
      const displaySecName = currentSector === 'PA FIXA' ? currentSubSector : currentSector;
      devicesContainer.innerHTML = `<div class="empty-state">Nenhum aparelho encontrado no setor ${displaySecName}.</div>`;
      return;
    }

    // Limpar contadores existentes antes de re-renderizar (PERF: ticker global único)
    clearAllCountdowns();

    filteredDevices.forEach(device => {
      const card = document.createElement('div');
      card.className = 'device-card glass';

      const showActions = currentUser && currentUser.isReadonly !== 1 && currentUser.isReadonly !== true && (currentUser.username === 'vicenzzo' || currentUser.allowEditDevices === true || currentUser.allowEditDevices === 1);

      // Header do Aparelho (Minimalista)
      const header = document.createElement('div');
      header.className = 'device-header';
      // Determine if we need to show the origin tag
      let originBadge = '';
      if (currentSector !== 'Todos' && !isDeviceSectorMatch(device.origin_sector || device.sector, currentSector, currentSubSector)) {
        originBadge = `<span class="sector-badge" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(255, 68, 68, 0.1); color: #ff6b6b; border: 1px solid rgba(255, 68, 68, 0.2); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Origem: ${escapeHTML(device.origin_sector || device.sector)}</span>`;
      }

      header.innerHTML = `
        <div class="device-title" style="display: flex; align-items: center; gap: 8px;">
          <span class="device-name" style="font-weight: 700; cursor: pointer;">${escapeHTML(device.name)}</span>
          ${currentSector === 'Todos' ? `<span class="sector-badge" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.1); color: var(--text-secondary); border: 1px solid var(--border-color); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">${escapeHTML(device.sector)}</span>` : ''}
          ${originBadge}
        </div>
        ${showActions ? `
        <div class="device-actions">
          <button class="icon-btn btn-edit-device-trigger" title="Configurar Aparelho">⚙️</button>
          <button class="icon-btn btn-add-number-trigger" title="Adicionar Chip" style="font-size: 0.8rem; font-weight: 600; color: var(--primary-color);">+ Chip</button>
        </div>
        ` : ''}
      `;

      // Evento de Editar Aparelho
      const editBtn = header.querySelector('.btn-edit-device-trigger');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          openEditDeviceModal(device);
        });
      }

      // Evento de Adicionar Número
      const addNumBtn = header.querySelector('.btn-add-number-trigger');
      if (addNumBtn) {
        addNumBtn.addEventListener('click', () => {
          openAddNumberModal(device.id);
        });
      }

      // Lista de Números
      const listContainer = document.createElement('div');
      listContainer.className = 'numbers-list';

      if (!device.numbers || device.numbers.length === 0) {
        listContainer.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding: 4px;">Sem chips.</div>';
      } else {
        const numbersToRender = device.numbers.filter(num => {
          return isNumberMatchSector(device, num, currentSector, currentSubSector);
        });

        if (numbersToRender.length === 0) {
          listContainer.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding: 4px;">Sem chips para este setor.</div>';
        } else {
          numbersToRender.forEach(num => {
            const row = document.createElement('div');
          row.className = 'number-row';
          row.id = `number-row-${num.id}`;

          // Formatando o status para classe CSS
          const statusClass = num.status.replace(/\s+/g, '-');

          const allowEdit = currentUser && (currentUser.username === 'vicenzzo' || currentUser.allowEditDevices === true || currentUser.allowEditDevices === 1);
          const isReadonly = currentUser && (currentUser.isReadonly === 1 || currentUser.isReadonly === true);
          let isReserva = device.name.toLowerCase().includes('reserva') || (num.name && num.name.toLowerCase().includes('reserva'));
          if (!isReserva && num.holder) {
            const holderLower = num.holder.toLowerCase().trim();
            const temPrincipal = devicesData.some(d => {
              const dRes = d.name.toLowerCase().includes('reserva');
              return d.numbers && d.numbers.some(n => {
                const nRes = n.name && n.name.toLowerCase().includes('reserva');
                if (!dRes && !nRes && n.id !== num.id) {
                  const nNameLower = (n.name || '').toLowerCase().trim();
                  const dNameLower = (d.name || '').toLowerCase().trim();
                  return nNameLower === holderLower || dNameLower === holderLower;
                }
                return false;
              });
            });
            if (temPrincipal) {
              isReserva = true;
            }
          }
          
          // Badge de ramal ao lado do NOME do chip (chips principais)
          let chipNameRamalBadge = '';
          let chipDisplayName = num.name || 'Sem Identificador';
          let colabPorNome = null;
          if (!isReserva) {
            const rawName = num.name || device.name;
            if (rawName) {
              colabPorNome = findCollaboratorInSystem(rawName);
            }
            if (colabPorNome) {
              chipDisplayName = colabPorNome.name;
              if (colabPorNome.ramal) {
                const cleanRamal = colabPorNome.ramal.replace('realess-', '');
                chipNameRamalBadge = `<span class="holder-ramal-badge" title="Ramal ${escapeHTML(cleanRamal)}">${escapeHTML(cleanRamal)}</span>`;
              }
            }
          }

          row.dataset.chipName = chipDisplayName.toLowerCase().trim();

          // Helper to get ramal badge for a holder name
          function getHolderRamalBadge(holderName) {
            if (!holderName) return '';
            const u = systemUsers.find(u => u.name.toLowerCase().trim() === holderName.toLowerCase().trim());
            if (u && u.ramal) {
              const cleanRamal = u.ramal.replace('realess-', '');
              return `<span class="holder-ramal-badge" title="Ramal ${escapeHTML(cleanRamal)}">${escapeHTML(cleanRamal)}</span>`;
            }
            return '';
          }

          // Ensure we have a holder list for this number (stored in a Map)
          const holders = holderLists.get(num.id) || [];

          // Check if this is a reserve with a holder (for cloning responsible person)
          const isReservaWithHolder = isReserva && holders.length > 0;

          let holderHtml = '';
          if (isReadonly) {
            if (holders.length === 0) {
              holderHtml = '';
            } else {
              let items = '';
              holders.forEach((h, idx) => {
                const ramalBadge = getHolderRamalBadge(h);
                const chipCount = holderChipCount.get(h) || 0;
                const countBadge = chipCount > 1 ? ` <span style="font-size: 0.6em; opacity: 0.7;">(${chipCount})</span>` : '';
                items += `
                  <div class="holder-item" style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed rgba(255, 255, 255, 0.05); width: 100%; box-sizing: border-box; font-size: 0.68rem;">
                    <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      <span style="font-size: 0.75rem; filter: grayscale(1); flex-shrink: 0; opacity: 0.5;">👤</span>
                      <span class="holder-name-link" data-holder-name="${escapeHTML(h)}" style="color: var(--text-secondary); font-weight: 600; cursor: pointer; text-decoration: none; border-bottom: 1px dashed rgba(255,255,255,0.35); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-underline-offset: 2px;">${escapeHTML(h)}</span>${ramalBadge}
                    </div>
                    <span style="flex-shrink: 0;">${countBadge}</span>
                  </div>
                `;
              });
              holderHtml = `
                <div class="holder-display-container" style="font-size: 0.68rem; margin-top: 4px; width: 100%;">
                  <div style="color: var(--text-secondary); opacity: 0.7; font-weight: 500; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
                    <span>👤 Com quem está:</span>
                  </div>
                  <div class="holder-items-list" style="display: flex; flex-direction: column; gap: 2px; width: 100%;">
                    ${items}
                  </div>
                </div>
              `;
            }
          } else {
            // Editable mode: container to be populated by refreshHolderDisplay()
            holderHtml = `<div class="holder-wrapper" data-number-id="${num.id}"></div>`;
          }

          // Verificar se este chip principal está associado a reservas
          let reservas = [];
          if (!isReserva) {
            const negotiatorName = getNegotiatorName(device, num);
            if (negotiatorName) {
              const negotiatorNameLower = negotiatorName.toLowerCase().trim();
              for (const key of Object.keys(reservaHolderMap)) {
                const keyLower = key.toLowerCase().trim();
                if (matchCollaboratorNames(negotiatorNameLower, keyLower)) {
                  reservas = reservaHolderMap[key];
                  break;
                }
              }
            }
          }

          if (reservas.length > 0) {
            row.classList.add('holder-in-reserva');
          }

          let reservaBadges = '';
          reservas.forEach(resInfo => {
            reservaBadges += `<span class="reserva-link-badge" data-reserva-number-id="${resInfo.numberId}" title="Responsável pela reserva ${resInfo.chipName} em ${resInfo.deviceName}" style="cursor: pointer; margin-left: 4px;">🔗 Reserva (${resInfo.last4})</span>`;
          });

          // HTML Básico da Linha (reorganizado em linhas)
          const statusDisabled = isReadonly;
          const showActions = !isReadonly && allowEdit;
          row.innerHTML = `
            <div class="number-row-top">
              <span class="chip-name-display" style="cursor: pointer;" title="Abrir a reserva ou o WhatsApp principal relacionado">
                ${escapeHTML(chipDisplayName)}${chipNameRamalBadge}${reservaBadges}
              </span>
              <div class="number-row-controls">
                <select class="status-select ${statusClass}" data-number-id="${num.id}" ${statusDisabled ? 'disabled' : ''}>
                  <option value="Livre" ${num.status === 'Livre' ? 'selected' : ''}>Livre</option>
                  <option value="Em Uso" ${num.status === 'Em Uso' ? 'selected' : ''}>Em Uso</option>
                  <option value="Banido" ${num.status === 'Banido' ? 'selected' : ''}>Banido</option>
                  <option value="Banido Definitivo" ${num.status === 'Banido Definitivo' ? 'selected' : ''}>Banido Definitivo</option>
                  <option value="Restrito 24 horas" ${num.status === 'Restrito 24 horas' ? 'selected' : ''}>Restrito 24h</option>
                  <option value="Restrito 7 dias" ${num.status === 'Restrito 7 dias' ? 'selected' : ''}>Restrito 7d</option>
                  <option value="Restrito Customizado" ${num.status === 'Restrito Customizado' ? 'selected' : ''}>Restrito Custom...</option>
                </select>
                ${showActions ? `
                <div class="number-row-actions">
                  <button class="icon-btn btn-move-number" data-number-id="${num.id}" title="Mover para outro aparelho">↔️</button>
                  <div class="delete-actions-wrapper">
                    <button class="icon-btn btn-delete-number" data-number-id="${num.id}" title="Excluir Chip">🗑️</button>
                    <div class="delete-confirm-popover" style="display: none;">
                      <span>Tem certeza?</span>
                      <div>
                        <button type="button" class="btn-confirm-delete-yes">Sim</button>
                        <button type="button" class="btn-confirm-delete-no">Não</button>
                      </div>
                    </div>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>
            <div class="phone-display">
              ${renderVeritasDot(num)}📞 ${formatPhoneNumberHTML(num.phone_number)}
            </div>
            ${num.in_hand === 1 ? `
            <div class="flags-area">
              <span class="flag-badge flag-inhand">✋ Na mão do negociador</span>
              ${!isReadonly && allowEdit ? `<button class="btn-clear-inhand" data-number-id="${num.id}" title="Limpar marcação de na mão do negociador">Limpar</button>` : ''}
            </div>
            ` : ''}
            ${holderHtml}
            ${isReserva && num.holder && isPrincipalLivre(num.holder) ? `
              <div class="reserva-return-alert">
                <span>⚠️ Principal Livre! Voltar ao principal.</span>
                <button class="btn-confirm-return-principal" data-number-id="${num.id}" data-colab-name="${escapeHTML(num.holder)}" title="Confirmar retorno ao número principal">Confirmar</button>
              </div>
            ` : ''}
            <div class="timer-area" style="display: none; margin-top: 4px;"></div>
            <div class="alarm-area" style="display: none; margin-top: 4px;"></div>
          `;

          // Evento de Alteração de Status
          const select = row.querySelector('.status-select');
          if (select) {
            select.addEventListener('change', (e) => {
              const newStatus = e.target.value;
              if (newStatus.startsWith('Restrito') || (isReserva && (newStatus === 'Banido' || newStatus === 'Banido Definitivo'))) {
                // Reverter select para o status anterior temporariamente até confirmar o modal de restrição/banimento
                select.value = num.status;
                const isAlreadyRestricted = num.status && (num.status.startsWith('Restrito') || num.status === 'Banido' || num.status === 'Banido Definitivo');
                openRestrictionSettingsModal(num.id, newStatus, isAlreadyRestricted);
              } else {
                sendWSMessage('UPDATE_NUMBER_STATUS', { numberId: num.id, status: newStatus, versao: getNumberVersion(num.id) });
              }
            });
          }

          // Evento de clique para copiar número de telefone
          const phoneDisplay = row.querySelector('.phone-display');
          if (phoneDisplay) {
            phoneDisplay.addEventListener('click', () => {
              const cleanNum = num.phone_number.replace(/\D/g, '');
              navigator.clipboard.writeText(cleanNum).then(() => {
                showToast(`Número ${formatPhoneNumber(cleanNum)} copiado!`);
              }).catch(err => {
                console.error('Erro ao copiar número:', err);
              });
            });
          }

          // Evento de confirmação de retorno ao principal
          const returnBtn = row.querySelector('.btn-confirm-return-principal');
          if (returnBtn) {
            returnBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const nId = parseInt(e.target.getAttribute('data-number-id'));
              const colabName = e.target.getAttribute('data-colab-name');
              
              if (confirm(`Deseja mesmo confirmar que o colaborador "${colabName}" já voltou para o número principal e liberar este chip de reserva?`)) {
                const vReturn = getNumberVersion(nId);
                sendWSMessage('UPDATE_NUMBER_HOLDER', { numberId: nId, holder: '', versao: vReturn });
                sendWSMessage('UPDATE_NUMBER_STATUS', { numberId: nId, status: 'Livre', versao: vReturn + 1 });
              }
            });
          }

          // Evento de Limpar marcação de "na mão do negociador"
          const clearInHandBtn = row.querySelector('.btn-clear-inhand');
          if (clearInHandBtn) {
            clearInHandBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const nId = parseInt(e.target.getAttribute('data-number-id'));
              const currentNum = findNumberInDevices(nId);
              const keepSite = currentNum && currentNum.site_history_active === 1 ? 1 : 0;
              sendWSMessage('UPDATE_NUMBER_FLAGS', { numberId: nId, siteHistoryActive: keepSite, inHand: 0, versao: getNumberVersion(nId) });
            });
          }

          // Evento de Alteração do Responsável (Holder) - suporte a múltiplos responsáveis verticalizados
          const holderWrapper = row.querySelector('.holder-wrapper');
          if (holderWrapper) {
            function refreshHolderDisplay() {
              const holderList = holderLists.get(num.id) || [];
              let itemsHtml = '';
              
              holderList.forEach((h, idx) => {
                const ramalBadge = getHolderRamalBadge(h);
                const chipCount = holderChipCount.get(h) || 0;
                const countBadge = chipCount > 1 ? ` <span style="font-size: 0.6em; opacity: 0.7;">(${chipCount})</span>` : '';
                itemsHtml += `
                  <div class="holder-item" style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed rgba(255, 255, 255, 0.05); width: 100%; box-sizing: border-box; font-size: 0.68rem;">
                    <div style="display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      <span style="font-size: 0.75rem; filter: grayscale(1); flex-shrink: 0; opacity: 0.5;">👤</span>
                      <span class="holder-name-link" data-holder-name="${escapeHTML(h)}" style="color: var(--text-secondary); font-weight: 600; cursor: pointer; text-decoration: none; border-bottom: 1px dashed rgba(255,255,255,0.35); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-underline-offset: 2px;">${escapeHTML(h)}</span>${ramalBadge}
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                      ${countBadge}
                      <button class="holder-remove" data-index="${idx}" style="background: none; border: none; color: #ff7675; cursor: pointer; font-size: 0.9rem; font-weight: bold; padding: 0 2px; display: flex; align-items: center; justify-content: center; line-height: 1; opacity: 0.8;" title="Remover Responsável">×</button>
                    </div>
                  </div>
                `;
              });

              // Generate options for the select dropdown, excluding already assigned holders
              let optionsHtml = `<option value="">+ Adicionar responsável...</option>`;
              systemUsers.forEach(u => {
                if (!holderList.includes(u.name)) {
                  const cleanRamal = u.ramal ? u.ramal.replace('realess-', '') : '';
                  const ramalText = cleanRamal ? ` (${cleanRamal})` : ' (Sem ramal)';
                  optionsHtml += `<option value="${escapeHTML(u.name)}">${escapeHTML(u.name)}${ramalText}</option>`;
                }
              });

              holderWrapper.innerHTML = `
                <div style="font-size: 0.68rem; margin-top: 4px; display: flex; flex-direction: column; gap: 2px; width: 100%;">
                  <div style="color: var(--text-secondary); opacity: 0.7; font-weight: 500; margin-bottom: 1px; display: flex; align-items: center; gap: 4px;">
                    <span>👤 Responsáveis:</span>
                  </div>
                  
                  ${holderList.length > 0 ? `
                    <div class="holder-items-list" style="display: flex; flex-direction: column; gap: 2px; width: 100%;">
                      ${itemsHtml}
                    </div>
                  ` : ''}

                  <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px; width: 100%;">
                    <select class="holder-select" data-number-id="${num.id}" style="flex: 1; height: 22px; font-size: 0.68rem; border-radius: 4px; padding: 0 6px; background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.12); color: var(--text-secondary); cursor: pointer; outline: none;">
                      ${optionsHtml}
                    </select>
                    <button class="btn-holder-search" data-number-id="${num.id}" title="Buscar e selecionar responsável" style="height: 22px; width: 24px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 0.72rem; color: var(--text-secondary); transition: all 0.2s;">🔍</button>
                  </div>
                </div>
              `;
              
              // Re-attach events
              attachHolderEvents();
            }

            function attachHolderEvents() {
              const wrapper = row.querySelector('.holder-wrapper');
              if (!wrapper) return;
              
              // Remove button clicks
              wrapper.querySelectorAll('.holder-remove').forEach(btn => {
                btn.addEventListener('click', e => {
                  e.stopPropagation();
                  const idx = parseInt(btn.dataset.index);
                  const holders = holderLists.get(num.id) || [];
                  holders.splice(idx, 1);
                  holderLists.set(num.id, holders);
                  updateHolderField(num.id, holders);
                  refreshHolderDisplay();
                });
              });
              
              // Select dropdown change event
              const select = wrapper.querySelector('.holder-select');
              if (select) {
                select.addEventListener('change', e => {
                  e.stopPropagation();
                  const val = e.target.value.trim();
                  if (val && !holderLists.get(num.id).includes(val)) {
                    const holders = holderLists.get(num.id) || [];
                    holders.push(val);
                    holderLists.set(num.id, holders);
                    updateHolderField(num.id, holders);
                    refreshHolderDisplay();
                  }
                });
              }

              // Search button click event
              const btnSearch = wrapper.querySelector('.btn-holder-search');
              if (btnSearch) {
                btnSearch.addEventListener('click', e => {
                  e.stopPropagation();
                  openSelectHolderModal(num.id, num.holder);
                });
              }

            }

            function updateHolderField(numberId, holdersArray) {
              const holderString = holdersArray.join(', ');
              sendWSMessage('UPDATE_NUMBER_HOLDER', { numberId: numberId, holder: holderString, versao: getNumberVersion(numberId) });
            }

            // Initial render
            refreshHolderDisplay();
          }

          // Evento de Mover Número para outro aparelho
          const moveBtn = row.querySelector('.btn-move-number');
          if (moveBtn) {
            moveBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              openMoveNumberModal(num.id, device);
            });
          }

          // Evento de Exclusão de Número com Popover "Tem certeza?"
          const deleteBtn = row.querySelector('.btn-delete-number');
          const popover = row.querySelector('.delete-confirm-popover');
          
          if (deleteBtn && popover) {
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              // Fechar outros popovers de exclusão abertos
              document.querySelectorAll('.delete-confirm-popover').forEach(p => {
                if (p !== popover) p.style.display = 'none';
              });
              popover.style.display = popover.style.display === 'flex' ? 'none' : 'flex';
            });

            row.querySelector('.btn-confirm-delete-yes').addEventListener('click', () => {
              sendWSMessage('DELETE_NUMBER', { numberId: num.id, versao: getNumberVersion(num.id) });
              popover.style.display = 'none';
            });

            row.querySelector('.btn-confirm-delete-no').addEventListener('click', () => {
              popover.style.display = 'none';
            });

            // Fechar popover ao clicar fora
            document.addEventListener('click', (e) => {
              if (!popover.contains(e.target) && e.target !== deleteBtn) {
                popover.style.display = 'none';
              }
            });
          }

          // Lógica de Timers e Alarmes
          const timerArea = row.querySelector('.timer-area');
          const alarmArea = row.querySelector('.alarm-area');

          // Limpar alarmes que não estão mais ativos
          if (num.alarm_active !== 1 && !num.restricted_until) {
            notifiedAlarms.delete(num.id);
          }

          if (num.alarm_active === 1) {
            // Alarme ativo
            row.classList.add('alarm-ringing');
            alarmArea.style.display = 'block';
            
            const isReadonly = currentUser && (currentUser.isReadonly === 1 || currentUser.isReadonly === true);
            alarmArea.innerHTML = `
              <div class="alarm-banner" style="font-size: 0.75rem; padding: 4px 8px;">
                <span>⏰ CHIP LIBERADO!</span>
                ${!isReadonly ? `<button class="btn-confirm-release" data-number-id="${num.id}" style="font-size: 0.7rem; padding: 1px 5px;">Confirmar</button>` : ''}
              </div>
            `;
            
            // Disparar Notificação do Windows e abrir Popup de Alarme
            if (!isReadonly && !notifiedAlarms.has(num.id)) {
              notifiedAlarms.add(num.id);
              triggerSystemNotification(
                '⏰ Chip Liberado no CRM!',
                `O chip "${num.name || 'Chip'}" (${formatPhoneNumber(num.phone_number)}) no aparelho "${device.name}" foi liberado da restrição.`,
                `alarm-${num.id}`
              );
              openAlarmPopup(num.id, device.name, num.name, num.phone_number);
            }

            const confirmBtn = alarmArea.querySelector('.btn-confirm-release');
            if (confirmBtn) {
              confirmBtn.addEventListener('click', () => {
                sendWSMessage('CONFIRM_RELEASE', { numberId: num.id, versao: getNumberVersion(num.id) });
                notifiedAlarms.delete(num.id);
                // Fechar popup se estiver aberto
                if (openAlarmPopups[num.id] && !openAlarmPopups[num.id].closed) {
                  openAlarmPopups[num.id].close();
                }
                delete openAlarmPopups[num.id];
              });
            }
          } else if (num.restricted_until) {
            // Tem restrição e o alarme não está disparado pelo servidor, mas vamos rodar a contagem regressiva local
            const isReadonlyUser = currentUser && (currentUser.isReadonly === 1 || currentUser.isReadonly === true);
            timerArea.style.display = 'block';
            timerArea.innerHTML = `
              <div class="timer-container" style="padding: 3px 8px; font-size: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span>Até voltar:</span>
                  <span class="timer-countdown" id="countdown-${num.id}">--:--:--</span>
                </div>
                ${!isReadonlyUser ? `<button type="button" class="btn-edit-restriction" data-number-id="${num.id}" style="background: none; border: none; cursor: pointer; padding: 2px; display: inline-flex; align-items: center; font-size: 0.85rem;" title="Editar tempo de restrição">✏️</button>` : ''}
              </div>
            `;
            
            // Iniciar contagem regressiva local por segundo (PERF: ticker global único)
            startGlobalCountdown(num.id, num.restricted_until, row, timerArea, alarmArea);

            const editRestBtn = timerArea.querySelector('.btn-edit-restriction');
            if (editRestBtn) {
              editRestBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openRestrictionSettingsModal(num.id, num.status, true);
              });
            }
          }

          listContainer.appendChild(row);




          // Attach event listeners for holder clone links (to add same holder)
          row.querySelectorAll('.holder-clone-link').forEach(link => {
            link.addEventListener('click', e => {
              e.stopPropagation();
              const holderName = e.target.getAttribute('data-holder-name');
              const numberId = parseInt(e.target.getAttribute('data-number-id'));

              if (holderName && numberId) {
                const holders = holderLists.get(numberId) || [];
                if (!holders.includes(holderName)) {
                  holders.push(holderName);
                  holderLists.set(numberId, holders);
                  updateHolderField(numberId, holders);
                  refreshHolderDisplay(); // This will refresh the holder display for this row
                }
              }
            });
          });
        });
      }
    }

      card.appendChild(header);
      card.appendChild(listContainer);
      devicesContainer.appendChild(card);
    });
  }

  // --- Renderização de Logs no Modal ---
  function updateLogManagerFilterOptions() {
    const select = document.getElementById('log-filter-manager');
    if (!select) return;
    
    const currentVal = select.value;
    const managers = new Set();
    
    if (logsData.bans) {
      logsData.bans.forEach(log => {
        if (log.user_name) managers.add(log.user_name.trim());
      });
    }
    if (logsData.general) {
      logsData.general.forEach(log => {
        if (log.user_name) managers.add(log.user_name.trim());
      });
    }
    if (logsData.reservations) {
      logsData.reservations.forEach(log => {
        if (log.assigned_by) managers.add(log.assigned_by.trim());
      });
    }
    
    const sortedManagers = Array.from(managers).sort((a, b) => a.localeCompare(b));
    
    select.innerHTML = '<option value="all">Tudo</option>';
    sortedManagers.forEach(mgr => {
      const opt = document.createElement('option');
      opt.value = mgr;
      opt.textContent = mgr;
      select.appendChild(opt);
    });
    
    if (Array.from(managers).includes(currentVal)) {
      select.value = currentVal;
    } else {
      select.value = 'all';
      logFilterManager = 'all';
    }
  }

  function renderLogs() {
    modalLogsTbody.innerHTML = '';
    
    // Atualizar cabeçalhos da tabela dinamicamente
    const theadTr = document.querySelector('#modal-logs table.logs-table thead tr');
    if (theadTr) {
      if (currentLogTab === 'reservations') {
        theadTr.innerHTML = `
          <th>Data/Hora</th>
          <th>Gestor</th>
          <th>Setor</th>
          <th>Aparelho</th>
          <th>Número</th>
          <th>Ação Realizada</th>
        `;
      } else {
        theadTr.innerHTML = `
          <th>Data/Hora</th>
          <th>Gestor</th>
          <th>Setor</th>
          <th>Aparelho</th>
          <th>Número</th>
          <th>Responsável</th>
          <th>Ação Realizada</th>
        `;
      }
    }

    const activeLogs = logsData[currentLogTab] || [];
    
    // Obter o setor de um log com correspondência precisa (priorizando o colaborador e log.sector)
    const getLogSector = (log) => {
      const h = (log.holder || '').toUpperCase().trim();
      const act = (log.action || '').toUpperCase();
      if (h === 'WEDLEY' || h.includes('WEDLEY') || act.includes('"WEDLEY"')) {
        return 'Senior';
      }
      if (log.sector) return log.sector;
      const rawPhone = log.phone_number || log.phoneNumber;
      if (rawPhone && rawPhone !== '-') {
        const clean = String(rawPhone).replace(/\D/g, '');
        for (const dev of devicesData) {
          if (dev.numbers && dev.numbers.some(n => String(n.phone_number || '').replace(/\D/g, '') === clean)) {
            return dev.sector;
          }
        }
      }
      const rawDev = log.device_name || log.deviceName;
      if (rawDev && rawDev !== '-') {
        const matchingDevs = devicesData.filter(d => d.name.toLowerCase() === rawDev.toLowerCase());
        if (matchingDevs.length === 1) return matchingDevs[0].sector;
      }
      return null;
    };

    // Filtrar os logs
    const filteredLogs = activeLogs.filter(log => {
      // 1. Filtrar por Gestor
      if (logFilterManager !== 'all') {
        const logManager = currentLogTab === 'reservations' 
          ? (log.assigned_by || log.assignedBy) 
          : (log.user_name || log.userName);
        if (!logManager || logManager.trim().toLowerCase() !== logFilterManager.trim().toLowerCase()) {
          return false;
        }
      }
      
      // 2. Filtrar por Setor (exato por número de chip / aparelho do setor)
      if (logFilterSector !== 'all') {
        const sector = getLogSector(log);
        if (sector !== logFilterSector) {
          return false;
        }
      }
      
      return true;
    });
    
    if (filteredLogs.length === 0) {
      const colSpan = currentLogTab === 'reservations' ? 6 : 7;
      modalLogsTbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; color: var(--text-secondary); padding: 25px;">Sem registros nesta categoria para o filtro selecionado.</td></tr>`;
      return;
    }

    filteredLogs.forEach(log => {
      const tr = document.createElement('tr');
      const formattedDate = new Date(log.timestamp).toLocaleString('pt-BR');
      const sectorName = getLogSector(log) || '—';
      const sectorBadge = sectorName !== '—'
        ? `<span class="collab-sector-tag" style="font-size: 0.68rem; padding: 2px 8px;">${escapeHTML(sectorName)}</span>`
        : `<span style="color: var(--text-secondary); opacity: 0.4;">—</span>`;
      
      if (currentLogTab === 'reservations') {
        tr.innerHTML = `
          <td>${formattedDate}</td>
          <td style="font-weight: 600; color: var(--primary-color);">${escapeHTML(log.assigned_by || log.assignedBy)}</td>
          <td>${sectorBadge}</td>
          <td><strong>${escapeHTML(log.device_name || log.deviceName)}</strong></td>
          <td style="font-family: monospace;">${formatPhoneNumber(log.phone_number || log.phoneNumber)} (${escapeHTML(log.chip_name || log.chipName)})</td>
          <td><span class="log-action-badge" style="background: rgba(0, 184, 148, 0.15); color: #00b894; border: 1px solid rgba(0, 184, 148, 0.3);">Entregue a: ${escapeHTML(log.user_assigned || log.userAssigned)}</span></td>
        `;
      } else {
        let cleanHolderDisplay = (log.holder || '').trim();
        if (cleanHolderDisplay.toUpperCase() === 'RESERVA') {
          cleanHolderDisplay = '';
        }
        tr.innerHTML = `
          <td>${formattedDate}</td>
          <td style="font-weight: 600; color: var(--primary-color);">${escapeHTML(log.user_name || log.userName)}</td>
          <td>${sectorBadge}</td>
          <td><strong>${escapeHTML(log.device_name || log.deviceName)}</strong></td>
          <td style="font-family: monospace;">${escapeHTML(log.phone_number || log.phoneNumber)}</td>
          <td style="font-weight: 600; color: var(--text-secondary);">${escapeHTML(cleanHolderDisplay || '—')}</td>
          <td><span class="log-action-badge">${escapeHTML(log.action)}</span></td>
        `;
      }
      modalLogsTbody.appendChild(tr);
    });
  }

  // --- Renderização do Inventário (Tabela Estilo Excel) ---
  function renderInventory() {
    inventoryTbody.innerHTML = '';
    
    // Definir a ordem dos setores
    const sectorOrder = ['Junior', 'Senior', 'PA FIXA', 'Pesquisa', 'Juridico', 'Comercial'];
    
    // Filtrar por setor se necessário
    const sectorsToShow = currentInventorySector === 'Todos' 
      ? sectorOrder 
      : [currentInventorySector];
    
    let rowNumber = 0;
    let totalDevices = 0;
    let totalChips = 0;
    
    sectorsToShow.forEach(sector => {
      const sectorDevices = devicesData
        .filter(d => d.sector === sector)
        .sort((a, b) => {
          const numA = parseInt(a.name, 10);
          const numB = parseInt(b.name, 10);
          const isNumA = !isNaN(numA);
          const isNumB = !isNaN(numB);
          if (isNumA && isNumB) return numA - numB;
          if (isNumA) return -1;
          if (isNumB) return 1;
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
      
      if (sectorDevices.length === 0) return;
      
      // Cabeçalho do setor (se mostrando todos)
      if (currentInventorySector === 'Todos') {
        const headerTr = document.createElement('tr');
        headerTr.className = 'sector-header-row';
        headerTr.innerHTML = `<td colspan="7">🏢 ${escapeHTML(sector)} — ${sectorDevices.length} aparelho(s)</td>`;
        inventoryTbody.appendChild(headerTr);
      }
      
      sectorDevices.forEach(device => {
        totalDevices++;
        
        if (!device.numbers || device.numbers.length === 0) {
          // Aparelho sem chips
          rowNumber++;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="inv-row-number">${rowNumber}</td>
            <td>${escapeHTML(sector)}</td>
            <td class="inv-device-name">${escapeHTML(device.name)}</td>
            <td style="color: var(--text-secondary); font-style: italic;">Sem chip cadastrado</td>
            <td>—</td>
            <td>—</td>
            <td style="text-align: center;"><span class="inv-status-badge sem-chip">Vazio</span></td>
          `;
          inventoryTbody.appendChild(tr);
        } else {
          device.numbers.forEach((num, idx) => {
            rowNumber++;
            totalChips++;
            
            const statusClass = getStatusClass(num.status);
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td class="inv-row-number">${rowNumber}</td>
              <td>${escapeHTML(sector)}</td>
              <td class="inv-device-name">${idx === 0 ? escapeHTML(device.name) : '<span style="color: var(--text-secondary); font-size: 0.72rem;">↳</span>'}</td>
              <td class="inv-chip-name">${escapeHTML(num.name || 'Sem identificador')}</td>
              <td class="inv-phone">${formatPhoneNumber(num.phone_number)}</td>
              <td class="inv-holder">${escapeHTML(num.holder || '—')}</td>
              <td style="text-align: center;"><span class="inv-status-badge ${statusClass}">${escapeHTML(num.status)}</span></td>
            `;
            inventoryTbody.appendChild(tr);
          });
        }
      });
    });
    
    // Atualizar contagem no rodapé
    if (rowNumber === 0) {
      inventoryTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 30px;">Nenhum aparelho cadastrado neste setor.</td></tr>';
      inventoryCount.textContent = '';
    } else {
      inventoryCount.textContent = `${totalDevices} aparelho(s) • ${totalChips} chip(s) • ${rowNumber} linha(s)`;
    }
  }
  
  function getStatusClass(status) {
    if (status === 'Livre') return 'livre';
    if (status === 'Em Uso') return 'em-uso';
    if (status === 'Banido' || status === 'Banido Definitivo') return 'banido';
    if (status.startsWith('Restrito')) return 'restrito';
    return '';
  }

  // --- Gerenciamento de Abas Principais ---
  sectorTabs.addEventListener('click', (e) => {
    const choice = e.target.closest('.split-choice');
    const splitTab = e.target.closest('.tab-btn-split');
    const normalTab = e.target.closest('.tab-btn:not(.tab-btn-split)');
    
    const isPaFixaOnly = isRestrictedPaFixaUser(currentUser);

    if (choice) {
      currentSector = choice.getAttribute('data-sector');
      currentSubSector = choice.getAttribute('data-subsector');
      persistCurrentSector();
      syncSectorTabsUI();
      renderDevices();
    } else if (normalTab) {
      const sec = normalTab.getAttribute('data-sector');
      if (isPaFixaOnly && sec !== 'PA FIXA') {
        return;
      }
      currentSector = sec;
      if (currentSector === 'PA FIXA') {
        currentSubSector = 'PA FIXA 1';
      }
      persistCurrentSector();
      syncSectorTabsUI();
      renderDevices();
    } else if (splitTab) {
      currentSector = 'PA FIXA';
      if (!currentSubSector) currentSubSector = 'PA FIXA 1';
      persistCurrentSector();
      syncSectorTabsUI();
      renderDevices();
    }
  });

  // --- Gerenciamento de Filtros de Status ---
  const statusFilters = document.getElementById('status-filters');
  if (statusFilters) {
    statusFilters.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-pill')) {
        document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-filter');
        renderDevices();
      }
    });
  }

  // --- Gerenciamento do Filtro de Apenas Reservas ---
  const filterReservasCheckbox = document.getElementById('filter-reservas-checkbox');
  if (filterReservasCheckbox) {
    filterReservasCheckbox.addEventListener('change', (e) => {
      showOnlyReservas = e.target.checked;
      renderDevices();
    });
  }

  // --- Gerenciamento de Abas do Modal de Logs ---
  function updateExportLogsLink() {
    const todayChecked = document.getElementById('export-today-only')?.checked;
    let href = `/api/export/logs?type=${currentLogTab}`;
    if (todayChecked) href += '&today=true';
    if (logFilterSector !== 'all') href += `&sector=${encodeURIComponent(logFilterSector)}`;
    if (logFilterManager !== 'all') href += `&manager=${encodeURIComponent(logFilterManager)}`;
    btnExportLogs.href = href;
  }

  const exportTodayOnly = document.getElementById('export-today-only');
  if (exportTodayOnly) {
    exportTodayOnly.addEventListener('change', updateExportLogsLink);
  }

  // Listeners dos Filtros de Histórico (Setor e Gestor)
  const logFilterSectorSelect = document.getElementById('log-filter-sector');
  if (logFilterSectorSelect) {
    logFilterSectorSelect.addEventListener('change', (e) => {
      logFilterSector = e.target.value;
      updateExportLogsLink();
      renderLogs();
    });
  }

  const logFilterManagerSelect = document.getElementById('log-filter-manager');
  if (logFilterManagerSelect) {
    logFilterManagerSelect.addEventListener('change', (e) => {
      logFilterManager = e.target.value;
      updateExportLogsLink();
      renderLogs();
    });
  }

  logTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      document.querySelectorAll('#log-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentLogTab = e.target.getAttribute('data-log-tab');
      
      // Atualizar o botão de exportar
      updateExportLogsLink();
      
      renderLogs();
    }
  });

  // --- Modais: Funções e Lógicas ---
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    const sidebar = document.getElementById('restricted-sidebar');
    if (sidebar) sidebar.style.display = 'none';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    if (!document.querySelector('.modal.active')) {
      document.body.classList.remove('modal-open');
      const sidebar = document.getElementById('restricted-sidebar');
      if (sidebar && sidebar.innerHTML.trim() !== '') {
        sidebar.style.display = 'flex';
      }
    }
    if (modal && modal.id === 'modal-dashboard') {
      stopDashboardPing();
    }
  }

  // Configurar fechar em todos os botões de fechar
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      closeModal(document.getElementById(modalId));
    });
  });

  // Fechar clicando fora da modal
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal(e.target);
    }
  });

  // Abertura do Modal de Histórico
  btnOpenLogs.addEventListener('click', () => {
    // Definir aba padrão e export padrão
    document.querySelectorAll('#log-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('#log-tabs [data-log-tab="bans"]').classList.add('active');
    currentLogTab = 'bans';
    if (exportTodayOnly) exportTodayOnly.checked = false;
    
    // Resetar filtros ao abrir
    logFilterSector = 'all';
    logFilterManager = 'all';
    const filterSecSelect = document.getElementById('log-filter-sector');
    const filterMgrSelect = document.getElementById('log-filter-manager');
    if (filterSecSelect) filterSecSelect.value = 'all';
    if (filterMgrSelect) filterMgrSelect.value = 'all';

    updateExportLogsLink();
    updateLogManagerFilterOptions();
    renderLogs();
    openModal(modalLogs);
  });

  // Abertura do Modal de Inventário
  btnOpenInventory.addEventListener('click', () => {
    // Resetar aba para Todos
    document.querySelectorAll('#inventory-sector-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('#inventory-sector-tabs [data-inv-sector="Todos"]').classList.add('active');
    currentInventorySector = 'Todos';
    renderInventory();
    openModal(modalInventory);
  });

  // Abas dentro do modal de inventário
  inventorySectorTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      document.querySelectorAll('#inventory-sector-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentInventorySector = e.target.getAttribute('data-inv-sector');
      renderInventory();
    }
  });

  // Modal: Adicionar Aparelho
  btnOpenAddDevice.addEventListener('click', () => {
    formAddDevice.reset();
    const sectorSelect = document.getElementById('device-sector-select');
    sectorSelect.value = currentSector === 'Todos' ? 'Junior' : currentSector;
    openModal(modalAddDevice);
  });

  formAddDevice.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('device-name-input').value.trim();
    const sector = document.getElementById('device-sector-select').value;
    
    if (name && sector) {
      sendWSMessage('ADD_DEVICE', { name, sector });
      closeModal(modalAddDevice);
    }
  });

  // Modal: Editar Aparelho
  function findNumberInDevices(numberId) {
    for (const dev of devicesData) {
      if (dev.numbers) {
        const num = dev.numbers.find(n => n.id === numberId);
        if (num) return num;
      }
    }
    return null;
  }

  function openEditDeviceModal(device) {
    document.getElementById('edit-device-id').value = device.id;
    document.getElementById('edit-device-name-input').value = device.name;
    document.getElementById('edit-device-sector-select').value = device.sector;
    
    // Injetar a lista de chips para atribuição de usuário
    const chipsListContainer = document.getElementById('edit-device-chips-list');
    chipsListContainer.innerHTML = '';
    
    if (device.numbers && device.numbers.length > 0) {
      device.numbers.forEach(num => {
        const row = document.createElement('div');
        row.className = 'edit-chip-row';

        const numBase = (num.name || '').replace(/\s+RESERVA(\s+\d+)?$/i, '').trim().toLowerCase();
        let hasMatch = false;
        if (!num.name || num.name === 'RESERVA') {
          hasMatch = true;
        }
        let optionsHtml = '';
        systemUsers.forEach(u => {
          const uBase = u.name.toLowerCase().trim();
          const isSelected = num.name && (num.name.toLowerCase().trim() === uBase || numBase === uBase);
          if (isSelected) hasMatch = true;
          const cleanRamal = u.ramal ? u.ramal.replace('realess-', '') : '';
          const ramalText = cleanRamal ? ` (${cleanRamal})` : ' (Sem ramal)';
          optionsHtml += `<option value="${escapeHTML(u.name)}" ${isSelected ? 'selected' : ''}>${escapeHTML(u.name)}${ramalText}</option>`;
        });
        
        let selectHtml = `<select class="edit-chip-name-input" data-number-id="${num.id}">`;
        selectHtml += `<option value="" ${!num.name ? 'selected' : ''}>Sem Usuário Atribuído</option>`;
        selectHtml += `<option value="RESERVA" ${num.name === 'RESERVA' ? 'selected' : ''}>RESERVA (Chip de Reserva)</option>`;
        if (num.name && !hasMatch) {
          selectHtml += `<option value="${escapeHTML(num.name)}" selected>${escapeHTML(num.name)} (Usuário Atual)</option>`;
        }
        selectHtml += optionsHtml;
        selectHtml += `</select>`;

        row.innerHTML = `
          <div class="edit-chip-phone-wrapper">
            <span style="font-size: 0.9rem;">📞</span>
            <input type="text" class="edit-chip-phone-input" data-number-id="${num.id}" value="${escapeHTML(num.phone_number)}" placeholder="Número">
          </div>
          ${selectHtml}
          <div class="edit-chip-flags">
            <label class="switch-container" style="gap: 6px;">
              <input type="checkbox" class="edit-chip-site-history" data-number-id="${num.id}" ${num.site_history_active === 1 ? 'checked' : ''}>
              <span class="switch-track" style="width: 28px; height: 16px;">
                <span class="switch-thumb" style="width: 12px; height: 12px;"></span>
              </span>
              <span style="font-size: 0.72rem; color: var(--text-secondary);">VERITAS</span>
            </label>
            <label class="switch-container" style="gap: 6px;">
              <input type="checkbox" class="edit-chip-in-hand" data-number-id="${num.id}" ${num.in_hand === 1 ? 'checked' : ''}>
              <span class="switch-track" style="width: 28px; height: 16px;">
                <span class="switch-thumb" style="width: 12px; height: 12px;"></span>
              </span>
              <span style="font-size: 0.72rem; color: var(--text-secondary);">Na mão</span>
            </label>
          </div>
        `;

        const siteSwitch = row.querySelector('.edit-chip-site-history');
        const inHandSwitch = row.querySelector('.edit-chip-in-hand');
        const sendFlags = () => {
          const nId = parseInt(siteSwitch.getAttribute('data-number-id'));
          sendWSMessage('UPDATE_NUMBER_FLAGS', {
            numberId: nId,
            siteHistoryActive: siteSwitch.checked ? 1 : 0,
            inHand: inHandSwitch.checked ? 1 : 0,
            versao: getNumberVersion(nId)
          });
        };
        siteSwitch.addEventListener('change', sendFlags);
        inHandSwitch.addEventListener('change', sendFlags);

        chipsListContainer.appendChild(row);
      });
    } else {
      chipsListContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">Nenhum chip neste aparelho.</p>';
    }
    
    openModal(modalEditDevice);
  }

  formEditDevice.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-device-id').value);
    const name = document.getElementById('edit-device-name-input').value.trim();
    const sector = document.getElementById('edit-device-sector-select').value;
    
    if (id && name && sector) {
      sendWSMessage('UPDATE_DEVICE', { id, name, sector });
      
      // Salvar atribuições de usuário e números dos chips
      document.querySelectorAll('.edit-chip-name-input').forEach(input => {
        const numberId = parseInt(input.getAttribute('data-number-id'));
        let newName = input.value.trim();
        const phoneInput = document.querySelector(`.edit-chip-phone-input[data-number-id="${numberId}"]`);
        const newPhone = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';
        
        if (numberId) {
          const originalNum = findNumberInDevices(numberId);
          if (originalNum) {
            // Se o usuário selecionado já possui outro chip, auto-formatar como RESERVA
            if (newName && newName.toUpperCase() !== 'RESERVA') {
              const baseNameMatch = newName.match(/^(.*?)(?:\s+RESERVA(?:\s+\d+)?)?$/i);
              const baseName = (baseNameMatch && baseNameMatch[1]) ? baseNameMatch[1].trim() : newName;
              
              const otherHas = devicesData.some(d => d.numbers && d.numbers.some(n => {
                if (n.id === numberId || !n.name || n.name.toUpperCase() === 'RESERVA') return false;
                const nBase = n.name.replace(/\s+RESERVA(\s+\d+)?$/i, '').trim().toLowerCase();
                return nBase === baseName.toLowerCase();
              }));

              if (otherHas && !newName.toUpperCase().endsWith('RESERVA')) {
                newName = `${baseName} RESERVA`;
              }
            }

            const nameChanged = originalNum.name !== newName;
            const phoneChanged = newPhone && originalNum.phone_number !== newPhone;
            
            if (nameChanged || phoneChanged) {
              sendWSMessage('UPDATE_NUMBER_DETAILS', { numberId, name: newName, phoneNumber: newPhone, versao: getNumberVersion(numberId) });
            }
          }
        }
      });
      
      closeModal(modalEditDevice);
    }
  });

  const deleteDeviceConfirmPopup = document.getElementById('delete-device-confirm');
  const btnConfirmDeviceDeleteYes = document.getElementById('btn-confirm-device-delete-yes');
  const btnConfirmDeviceDeleteNo = document.getElementById('btn-confirm-device-delete-no');

  btnDeleteDevice.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = parseInt(document.getElementById('edit-device-id').value);
    if (!id) return;
    // Fechar outros popovers abertos
    document.querySelectorAll('.delete-confirm-popover').forEach(p => {
      if (p !== deleteDeviceConfirmPopup) p.style.display = 'none';
    });
    deleteDeviceConfirmPopup.style.display = deleteDeviceConfirmPopup.style.display === 'flex' ? 'none' : 'flex';
  });

  btnConfirmDeviceDeleteYes.addEventListener('click', () => {
    const id = parseInt(document.getElementById('edit-device-id').value);
    const name = document.getElementById('edit-device-name-input').value;
    if (id) {
      sendWSMessage('DELETE_DEVICE', { id });
      closeModal(modalEditDevice);
    }
    deleteDeviceConfirmPopup.style.display = 'none';
  });

  btnConfirmDeviceDeleteNo.addEventListener('click', () => {
    deleteDeviceConfirmPopup.style.display = 'none';
  });

  // Fechar popover ao clicar fora
  document.addEventListener('click', (e) => {
    if (deleteDeviceConfirmPopup.style.display === 'flex' &&
        !deleteDeviceConfirmPopup.contains(e.target) &&
        e.target !== btnDeleteDevice) {
      deleteDeviceConfirmPopup.style.display = 'none';
    }
  });

  // Modal: Mover Número para outro Aparelho
  const modalMoveNumber = document.getElementById('modal-move-number');
  const formMoveNumber = document.getElementById('form-move-number');
  const moveDeviceSelect = document.getElementById('move-device-select');

  function openMoveNumberModal(numberId, currentDevice) {
    document.getElementById('move-number-id').value = numberId;
    moveDeviceSelect.innerHTML = '<option value="">Carregando...</option>';
    openModal(modalMoveNumber);

    // Preencher dropdown com todos os aparelhos do mesmo setor (exceto o atual)
    const sectorDevices = devicesData.filter(d => d.sector === currentDevice.sector && d.id !== currentDevice.id);
    
    if (sectorDevices.length === 0) {
      moveDeviceSelect.innerHTML = '<option value="">Nenhum outro aparelho disponível neste setor</option>';
      return;
    }

    moveDeviceSelect.innerHTML = '<option value="">Selecione o aparelho de destino...</option>';
    sectorDevices
      .sort((a, b) => {
        const numA = parseInt(a.name, 10);
        const numB = parseInt(b.name, 10);
        const isNumA = !isNaN(numA);
        const isNumB = !isNaN(numB);
        if (isNumA && isNumB) return numA - numB;
        if (isNumA) return -1;
        if (isNumB) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      })
      .forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.name} (${d.sector})`;
        moveDeviceSelect.appendChild(opt);
      });
  }

  if (formMoveNumber) {
    formMoveNumber.addEventListener('submit', (e) => {
      e.preventDefault();
      const numberId = parseInt(document.getElementById('move-number-id').value);
      const targetDeviceId = parseInt(moveDeviceSelect.value);

      if (!targetDeviceId) {
        alert('Selecione um aparelho de destino.');
        return;
      }

      if (confirm('Confirmar movimentação do chip para o aparelho selecionado?')) {
        sendWSMessage('MOVE_NUMBER', { numberId, targetDeviceId, versao: getNumberVersion(numberId) });
        closeModal(modalMoveNumber);
      }
    });
  }

  // Modal: Adicionar Número
  function openAddNumberModal(deviceId) {
    formAddNumber.reset();
    document.getElementById('add-number-device-id').value = deviceId;
    
    const nameSelect = document.getElementById('add-number-name-input');
    if (nameSelect) {
      let optionsHtml = '';
      optionsHtml += '<option value="">Sem Usuário Atribuído</option>';
      optionsHtml += '<option value="RESERVA">RESERVA (Chip de Reserva)</option>';

      // Coletar usuários que já possuem chips cadastrados
      const existingUserNames = new Set();
      devicesData.forEach(d => {
        if (d.numbers) {
          d.numbers.forEach(n => {
            if (n.name && n.name.trim().toUpperCase() !== 'RESERVA') {
              const base = n.name.replace(/\s+RESERVA(\s+\d+)?$/i, '').trim().toLowerCase();
              existingUserNames.add(base);
            }
          });
        }
      });

      systemUsers.forEach(u => {
        const cleanRamal = u.ramal ? u.ramal.replace('realess-', '') : '';
        const ramalText = cleanRamal ? ` (${cleanRamal})` : ' (Sem ramal)';
        const uBase = u.name.trim().toLowerCase();
        const alreadyHas = existingUserNames.has(uBase);
        const suffixBadge = alreadyHas ? ' [➔ Criará como RESERVA]' : '';
        optionsHtml += `<option value="${escapeHTML(u.name)}">${escapeHTML(u.name)}${ramalText}${suffixBadge}</option>`;
      });
      nameSelect.innerHTML = optionsHtml;
    }
    
    openModal(modalAddNumber);
  }

  formAddNumber.addEventListener('submit', (e) => {
    e.preventDefault();
    const deviceId = parseInt(document.getElementById('add-number-device-id').value);
    let name = document.getElementById('add-number-name-input').value.trim();
    const phoneNumber = document.getElementById('add-number-phone-input').value.trim().replace(/\D/g, ''); // Apenas números
    const holder = document.getElementById('add-number-holder-input').value.trim();

    if (!phoneNumber) {
      alert('Por favor, digite um número válido.');
      return;
    }

    // Se o usuário selecionado já possui outro chip no sistema, auto-formatar como RESERVA
    if (name && name.toUpperCase() !== 'RESERVA') {
      const baseNameMatch = name.match(/^(.*?)(?:\s+RESERVA(?:\s+\d+)?)?$/i);
      const baseName = (baseNameMatch && baseNameMatch[1]) ? baseNameMatch[1].trim() : name;
      
      const alreadyHas = devicesData.some(d => d.numbers && d.numbers.some(n => {
        if (!n.name || n.name.toUpperCase() === 'RESERVA') return false;
        const nBase = n.name.replace(/\s+RESERVA(\s+\d+)?$/i, '').trim().toLowerCase();
        return nBase === baseName.toLowerCase();
      }));

      if (alreadyHas && !name.toUpperCase().endsWith('RESERVA')) {
        name = `${baseName} RESERVA`;
      }
    }

    sendWSMessage('ADD_NUMBER', { deviceId, phoneNumber, name, holder });
    closeModal(modalAddNumber);
  });

  // Modal Unificado de Configurações de Restrição (Com Horário de Início)
  function openRestrictionSettingsModal(numberId, statusType, isEditing = false) {
    formRestrictionSettings.reset();
    
    document.getElementById('restriction-number-id').value = numberId;
    document.getElementById('restriction-status-type').value = statusType;
    
    // Buscar o número nas informações locais para obter o restricted_at se estiver em modo de edição
    let startTimeVal = getLocalDateTimeString();
    if (isEditing) {
      const numObj = findNumberByIdLocal(numberId);
      if (numObj && numObj.restricted_at) {
        startTimeVal = getLocalDateTimeString(new Date(numObj.restricted_at));
      } else if (numObj && numObj.restricted_until) {
        // Fallback no caso do chip antigo não possuir restricted_at
        const untilTime = new Date(numObj.restricted_until).getTime();
        let calculatedStart = Date.now();
        if (statusType === 'Restrito 24 horas') {
          calculatedStart = untilTime - (24 * 60 * 60 * 1000);
        } else if (statusType === 'Restrito 7 dias') {
          calculatedStart = untilTime - (7 * 24 * 60 * 60 * 1000);
        } else if (statusType === 'Banido') {
          calculatedStart = untilTime - (6 * 60 * 60 * 1000);
        }
        startTimeVal = getLocalDateTimeString(new Date(calculatedStart));
      }
    }
    
    // Setar Horário de Início
    document.getElementById('restriction-start-time').value = startTimeVal;

    // Preencher dropdown de Responsável / Colaborador
    const holderSelect = document.getElementById('restriction-holder-select');
    if (holderSelect) {
      const numObj = findNumberByIdLocal(numberId);
      let suggestedHolder = '';
      
      if (numObj) {
        if (numObj.holder && numObj.holder.trim()) {
          const hTrim = numObj.holder.trim();
          if (hTrim.toUpperCase() !== 'RESERVA') {
            suggestedHolder = hTrim.split(',')[0].trim();
          }
        }
        
        if (!suggestedHolder && numObj.name && numObj.name.trim()) {
          const cleanName = numObj.name.replace(/\s+(RES\.?|RESERVA|PESQUISA|BACKOFFICE)$/i, '').trim();
          if (cleanName.toUpperCase() !== 'RESERVA' && !cleanName.toUpperCase().startsWith('RESERVA')) {
            suggestedHolder = cleanName;
          }
        }

        if (!suggestedHolder && logsData.reservations && numObj.phone_number) {
          const cleanPhone = String(numObj.phone_number).replace(/\D/g, '');
          const lastRes = logsData.reservations.find(r => {
            const rPhone = String(r.phone_number || r.phoneNumber || '').replace(/\D/g, '');
            return rPhone === cleanPhone && (r.user_assigned || r.userAssigned);
          });
          if (lastRes) {
            suggestedHolder = (lastRes.user_assigned || lastRes.userAssigned || '').trim();
          }
        }
      }

      let optionsHtml = '<option value="">(Sem responsável informado)</option>';
      let foundSelected = false;
      const sortedUsers = [...systemUsers].sort((a, b) => a.name.localeCompare(b.name));
      sortedUsers.forEach(u => {
        const isSelected = suggestedHolder && u.name.toLowerCase().trim() === suggestedHolder.toLowerCase().trim();
        if (isSelected) foundSelected = true;
        const cleanRamal = u.ramal ? u.ramal.replace('realess-', '') : '';
        const ramalText = cleanRamal ? ` (${cleanRamal})` : '';
        optionsHtml += `<option value="${escapeHTML(u.name)}" ${isSelected ? 'selected' : ''}>${escapeHTML(u.name)}${ramalText}</option>`;
      });

      if (suggestedHolder && !foundSelected) {
        optionsHtml += `<option value="${escapeHTML(suggestedHolder)}" selected>${escapeHTML(suggestedHolder)}</option>`;
      }

      holderSelect.innerHTML = optionsHtml;
    }
    
    const durationGroup = document.getElementById('restriction-custom-duration-group');
    const title = document.getElementById('restriction-settings-title');
    const submitBtn = formRestrictionSettings.querySelector('button[type="submit"]');

    if (isEditing) {
      if (statusType === 'Restrito Customizado') {
        title.textContent = 'Ajustar Restrição Customizada';
        durationGroup.style.display = 'block';
        document.getElementById('restriction-custom-time').required = true;
      } else if (statusType === 'Banido') {
        title.textContent = 'Ajustar Banimento (6 Horas)';
        durationGroup.style.display = 'none';
        document.getElementById('restriction-custom-time').required = false;
      } else if (statusType === 'Banido Definitivo') {
        title.textContent = 'Ajustar Banimento Definitivo';
        durationGroup.style.display = 'none';
        document.getElementById('restriction-custom-time').required = false;
      } else {
        const labelText = statusType === 'Restrito 24 horas' ? '24 Horas' : '7 Dias';
        title.textContent = `Ajustar Restrição - ${labelText}`;
        durationGroup.style.display = 'none';
        document.getElementById('restriction-custom-time').required = false;
      }
      if (submitBtn) submitBtn.textContent = 'Salvar Alterações';
    } else {
      if (statusType === 'Restrito Customizado') {
        title.textContent = 'Configurar Restrição Customizada';
        durationGroup.style.display = 'block';
        document.getElementById('restriction-custom-time').required = true;
      } else if (statusType === 'Banido') {
        title.textContent = 'Confirmar Banimento (6 Horas)';
        durationGroup.style.display = 'none';
        document.getElementById('restriction-custom-time').required = false;
      } else if (statusType === 'Banido Definitivo') {
        title.textContent = 'Confirmar Banimento Definitivo';
        durationGroup.style.display = 'none';
        document.getElementById('restriction-custom-time').required = false;
      } else {
        const labelText = statusType === 'Restrito 24 horas' ? '24 Horas' : '7 Dias';
        title.textContent = `Configurar Restrição - ${labelText}`;
        durationGroup.style.display = 'none';
        document.getElementById('restriction-custom-time').required = false;
      }
      if (submitBtn) submitBtn.textContent = statusType.startsWith('Banido') ? 'Confirmar Banimento' : 'Iniciar Restrição';
    }

    openModal(modalRestrictionSettings);
  }

  formRestrictionSettings.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const numberId = parseInt(document.getElementById('restriction-number-id').value);
    const status = document.getElementById('restriction-status-type').value;
    const startTimeStr = document.getElementById('restriction-start-time').value;
    const holderSelect = document.getElementById('restriction-holder-select');
    const holder = holderSelect ? holderSelect.value.trim() : '';
    
    if (!startTimeStr) {
      alert('Selecione um horário de início.');
      return;
    }

    const startTime = new Date(startTimeStr).toISOString();
    let durationMinutes = null;

    if (status === 'Restrito Customizado') {
      const amount = parseInt(document.getElementById('restriction-custom-time').value);
      const unit = document.getElementById('restriction-custom-unit').value;

      if (!amount) {
        alert('Digite o tempo de restrição.');
        return;
      }

      durationMinutes = amount;
      if (unit === 'hours') {
        durationMinutes = amount * 60;
      } else if (unit === 'days') {
        durationMinutes = amount * 24 * 60;
      }
    }

    sendWSMessage('UPDATE_NUMBER_STATUS', {
      numberId,
      status,
      startTime,
      durationMinutes,
      holder,
      versao: getNumberVersion(numberId)
    });

    closeModal(modalRestrictionSettings);
  });

  // --- Ações Extras (Logout) ---
  btnLogout.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = window.location.pathname.startsWith('/crm') ? '/crm/login.html' : './login.html';
      }
    } catch (err) {
      console.error('Erro ao efetuar logout:', err);
    }
  });

  // --- Funções Auxiliares ---
  function findNumberByIdLocal(numberId) {
    for (const dev of devicesData) {
      if (dev.numbers) {
        const num = dev.numbers.find(n => n.id === numberId);
        if (num) return num;
      }
    }
    return null;
  }

  function getLocalDateTimeString(date) {
    const now = date instanceof Date ? date : new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  function formatPhoneNumber(numStr) {
    if (!numStr) return '';
    
    const clean = numStr.replace(/\D/g, '');
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    } else if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    
    return numStr;
  }

  function formatPhoneNumberHTML(numStr) {
    if (!numStr) return '';
    const clean = numStr.replace(/\D/g, '');
    if (clean.length === 11) {
      // Usando hífen não-quebrável \u2011 para travar o número na mesma linha
      const prefix = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}\u2011`;
      const suffix = clean.slice(7);
      return `${prefix}<span class="phone-suffix-badge">${suffix}</span>`;
    } else if (clean.length === 10) {
      const prefix = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}\u2011`;
      const suffix = clean.slice(6);
      return `${prefix}<span class="phone-suffix-badge">${suffix}</span>`;
    }
    return numStr;
  }

  // --- Popup de Alarme ---
  function openAlarmPopup(numberId, deviceName, chipName, phoneNumber) {
    // Se já existe um popup aberto para este número, apenas dar foco
    if (openAlarmPopups[numberId] && !openAlarmPopups[numberId].closed) {
      openAlarmPopups[numberId].focus();
      return;
    }

    const params = new URLSearchParams({
      device: deviceName || 'Desconhecido',
      chip: chipName || 'Chip',
      phone: phoneNumber || '',
      numberId: numberId.toString()
    });

    const popupUrl = `/popup.html?${params.toString()}`;
    
    // Calcular posição centralizada na tela
    const popW = 460;
    const popH = 420;
    const left = Math.max(0, Math.round((screen.width - popW) / 2));
    const top = Math.max(0, Math.round((screen.height - popH) / 2));
    
    const features = `width=${popW},height=${popH},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=no,resizable=no,status=no`;
    
    const popup = window.open(popupUrl, `alarm-${numberId}`, features);
    
    if (popup) {
      openAlarmPopups[numberId] = popup;
      popup.focus();
    } else {
      // Popup bloqueado pelo navegador
      console.warn('Popup de alarme bloqueado pelo navegador. Permita popups para localhost.');
    }
  }

  // --- Funções de Gerenciamento de Gestores (Restrito ao Vicenzzo) ---
  async function openManageUsersModal() {
    if (!currentUser || currentUser.isReadonly === 1 || currentUser.isReadonly === true) {
      return;
    }

    formManageUsers.reset();
    
    // Resetar visibilidade dos switches de cadastro de gestores no formulário
    const editDevicesWrapper = document.getElementById('new-user-edit-devices')?.closest('.switch-container');
    const manageUsersWrapper = document.getElementById('new-user-manage-users')?.closest('.switch-container');
    if (editDevicesWrapper) editDevicesWrapper.style.display = 'flex';
    if (manageUsersWrapper) manageUsersWrapper.style.display = 'flex';
    if (formManageCollaborators) formManageCollaborators.reset();
    manageUsersErrorMsg.textContent = '';
    if (manageColabsErrorMsg) manageColabsErrorMsg.textContent = '';
    if (searchManagersInput) { searchManagersInput.value = ''; managerSearchQuery = ''; }
    if (searchCollaboratorsInput) { searchCollaboratorsInput.value = ''; collaboratorSearchQuery = ''; }

    const canManage = currentUser.username === 'vicenzzo' || currentUser.allowManageUsers === true || currentUser.allowManageUsers === 1;

    // Configurar a visibilidade da aba de Gestores no DOM
    const tabUsers = document.querySelector('#manage-users-tabs .tab-btn[data-manage-tab="users"]');
    if (tabUsers) {
      tabUsers.style.display = canManage ? 'inline-block' : 'none';
    }

    // Configurar aba ativa inicial
    let activeTab = 'users';
    if (!canManage) {
      activeTab = 'collaborators';
    }

    document.querySelectorAll('#manage-users-tabs .tab-btn').forEach(b => {
      if (b.getAttribute('data-manage-tab') === activeTab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    document.getElementById('manage-users-section-users').style.display = activeTab === 'users' ? 'block' : 'none';
    document.getElementById('manage-users-section-collaborators').style.display = activeTab === 'collaborators' ? 'block' : 'none';
    document.getElementById('manage-users-section-updates').style.display = 'none';

    if (canManage) {
      await loadUsersList();
    }
    await loadCollaboratorsList();
    openModal(modalManageUsers);
  }

  let managerRoleFilter = 'all';
  let collaboratorSectorFilter = 'all';

  async function loadUsersList() {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Erro ao buscar usuários');
      const users = await response.json();

      // Métricas de estatísticas e contadores UIX
      const total = users.length;
      const gestoresFull = users.filter(u => u.is_readonly === 0).length;
      const visualizadores = users.filter(u => u.is_readonly === 1).length;
      const ativos = users.filter(u => u.is_active !== 0).length;

      const totalBadge = document.getElementById('manage-users-total-badge');
      if (totalBadge) totalBadge.textContent = `${total} Gestores Cadastrados`;
      const tabBadge = document.getElementById('counter-tab-gestores');
      if (tabBadge) tabBadge.textContent = total;
      const statTotal = document.getElementById('stat-total-gestores');
      if (statTotal) statTotal.textContent = total;
      const statFull = document.getElementById('stat-gestores-full');
      if (statFull) statFull.textContent = gestoresFull;
      const statViewers = document.getElementById('stat-visualizadores');
      if (statViewers) statViewers.textContent = visualizadores;
      const statAtivos = document.getElementById('stat-gestores-ativos');
      if (statAtivos) statAtivos.textContent = ativos;
      
      if (!manageUsersCardsContainer) return;
      manageUsersCardsContainer.innerHTML = '';
      
      for (const user of users) {
        const isSelf = user.username === 'vicenzzo';
        
        const initials = user.name
          ? user.name.split(' ').slice(0, 2).map(n => n[0]).join('')
          : 'G';
          
        const card = document.createElement('div');
        card.className = `manager-card glass${user.is_active === 0 ? ' inactive-manager-card' : ''}`;
        card.setAttribute('data-user-name', (user.name || '').toLowerCase());
        card.setAttribute('data-user-username', (user.username || '').toLowerCase());
        card.setAttribute('data-role', user.is_readonly === 0 ? 'gestores' : 'viewers');
        
        const ramalBadge = user.ramal
          ? ` <span class="manager-ramal-badge">${escapeHTML(user.ramal.replace('realess-', ''))}</span>`
          : '';

        let roleBadgeHtml = '';
        if (isSelf) {
          roleBadgeHtml = '<span class="badge master" style="font-size: 0.62rem; padding: 2px 8px;">MASTER</span>';
        } else if (user.is_readonly === 0) {
          roleBadgeHtml = '<span class="badge manager" style="font-size: 0.62rem; padding: 2px 8px;">GESTOR</span>';
        } else {
          roleBadgeHtml = '<span class="badge" style="font-size: 0.62rem; padding: 2px 8px; background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3);">VISUALIZADOR</span>';
        }

        const activeStatusDot = user.is_active !== 0
          ? '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.65rem; color: #2ed573; font-weight: 700;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #2ed573; box-shadow: 0 0 6px #2ed573;"></span>Ativo</span>'
          : '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.65rem; color: #ff4757; font-weight: 700;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #ff4757;"></span>Inativo</span>';
          
        let permissionsHtml = '';
        let actionsHtml = '';
        
        if (isSelf) {
          permissionsHtml = `
            <div class="manager-mestre-badge">
              <span>👑</span>
              <span>Mestre (Acesso Total e Vitalício)</span>
            </div>
          `;
        } else {
          // As permissões agora já vêm acopladas do Backend (Eager Loading)
          let sectorPerms = user.sectorPermissions || [];

          // Construindo o painel expandível de Setores (Acordeon)
          let sectorsHtml = `<div class="manager-sectors-panel" id="sectors-panel-${user.id}">`;
          sectorsHtml += `<div style="font-size: 0.7rem; color: var(--primary-color); font-weight: 800; margin-bottom: 5px; text-transform: uppercase;">Acesso por Setor</div>`;
          
          availableSectors.forEach(sector => {
            const perm = sectorPerms.find(p => p.sector === sector) || { can_view: 1, can_configure: 1 }; // Padrão se não existir
            
            // Oculta opção de "Configurar" se o usuário for Apenas Leitura Global
            const configDisabled = user.is_readonly === 1 ? 'disabled style="opacity: 0.3;"' : '';
            const isConfigChecked = user.is_readonly === 1 ? false : (perm.can_configure === 1);
            
            sectorsHtml += `
              <div class="sector-perm-row">
                <span class="sector-perm-name">${escapeHTML(sector)}</span>
                <div class="sector-perm-toggles">
                  <label class="switch-container" style="gap: 5px;">
                    <input type="checkbox" class="switch-input sector-view-cb" data-user-id="${user.id}" data-sector="${sector}" ${perm.can_view === 1 ? 'checked' : ''}>
                    <span class="switch-slider" style="width: 28px; height: 16px;"></span>
                    <span class="switch-label" style="font-size: 0.65rem;">Ver</span>
                  </label>
                  <label class="switch-container" style="gap: 5px;" ${configDisabled}>
                    <input type="checkbox" class="switch-input sector-config-cb" data-user-id="${user.id}" data-sector="${sector}" ${isConfigChecked ? 'checked' : ''} ${configDisabled}>
                    <span class="switch-slider" style="width: 28px; height: 16px;"></span>
                    <span class="switch-label" style="font-size: 0.65rem;">Modificar</span>
                  </label>
                </div>
              </div>
            `;
          });
          sectorsHtml += `</div>`; // Fim do painel

          permissionsHtml = `
            <div class="input-group" style="margin-bottom: 8px;">
              <select class="role-select-input" data-user-id="${user.id}" style="padding: 7px 10px; font-size: 0.78rem; font-weight: 700; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f8fafc;">
                <option value="0" ${user.is_readonly === 0 ? 'selected' : ''}>🛠️ Nível: GESTOR (Pode Alterar)</option>
                <option value="1" ${user.is_readonly === 1 ? 'selected' : ''}>👁️ Nível: VISUALIZADOR</option>
              </select>
            </div>
            
            <div style="display:flex; flex-direction: column; gap: 6px; margin: 10px 0;">
                <label class="switch-container">
                  <input type="checkbox" class="switch-input allow-all-tabs-checkbox" data-user-id="${user.id}" ${user.allow_all_tabs === 1 ? 'checked' : ''}>
                  <span class="switch-slider"></span>
                  <span class="switch-label" style="font-size: 0.72rem;">Aba "Todos"</span>
                </label>

                <label class="switch-container" ${user.is_readonly === 1 ? 'style="display: none;"' : ''}>
                  <input type="checkbox" class="switch-input allow-edit-devices-checkbox" data-user-id="${user.id}" ${user.allow_edit_devices === 1 ? 'checked' : ''}>
                  <span class="switch-slider"></span>
                  <span class="switch-label" style="font-size: 0.72rem;">Editar Celulares</span>
                </label>

                <label class="switch-container" ${user.is_readonly === 1 ? 'style="display: none;"' : ''}>
                  <input type="checkbox" class="switch-input allow-manage-users-checkbox" data-user-id="${user.id}" ${user.allow_manage_users === 1 ? 'checked' : ''}>
                  <span class="switch-slider"></span>
                  <span class="switch-label" style="font-size: 0.72rem;">Cadastrar Gestores</span>
                </label>

                <label class="switch-container" ${user.is_readonly === 1 ? 'style="display: none;"' : ''}>
                  <input type="checkbox" class="switch-input allow-dashboard-checkbox" data-user-id="${user.id}" ${user.allow_dashboard === 1 ? 'checked' : ''}>
                  <span class="switch-slider"></span>
                  <span class="switch-label" style="font-size: 0.72rem;">Visualizar Dashboard</span>
                </label>

                <label class="switch-container">
                  <input type="checkbox" class="switch-input is-active-checkbox" data-user-id="${user.id}" ${user.is_active !== 0 ? 'checked' : ''}>
                  <span class="switch-slider"></span>
                  <span class="switch-label" style="font-size: 0.72rem; color: var(--status-free);">Acesso Ativo</span>
                </label>
            </div>
            
            ${sectorsHtml}
          `;
          
          actionsHtml = `
            <button class="btn-secondary btn-toggle-sectors" data-user-id="${user.id}" style="flex: 1; font-size: 0.72rem; font-weight: 700;">⚙️ Setores</button>
            <button class="btn-danger btn-delete-user" data-user-id="${user.id}" data-user-name="${user.name}" style="font-size: 0.72rem; font-weight: 700;">🗑️ Excluir</button>
          `;
        }

        card.innerHTML = `
          <div class="manager-profile">
            <div class="manager-avatar">${escapeHTML(initials)}</div>
            <div class="manager-info">
              <div class="manager-name" style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                <span style="font-size: 0.92rem; font-weight: 800; color: #f8fafc;">${escapeHTML(user.name)}</span>
                ${roleBadgeHtml}
              </div>
              <div class="manager-meta" style="display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
                <span style="color: #94a3b8; font-family: monospace; font-size: 0.72rem;">@${escapeHTML(user.username)} ${ramalBadge}</span>
                ${activeStatusDot}
              </div>
            </div>
          </div>
          <div class="manager-permissions-grid">
            ${permissionsHtml}
          </div>
          <div class="manager-actions">
            ${actionsHtml}
          </div>
        `;

        if (!isSelf) {
          // --- LISTENERS DOS BOTÕES DO CARD ---
          
          // Excluir Gestor
          card.querySelector('.btn-delete-user').addEventListener('click', () => {
            deleteUser(user.id, user.name);
          });

          // Toggle Expandir Setores
          card.querySelector('.btn-toggle-sectors').addEventListener('click', (e) => {
            const panel = card.querySelector(`#sectors-panel-${user.id}`);
            panel.classList.toggle('open');
            const isOpen = panel.classList.contains('open');
            e.currentTarget.textContent = isOpen ? '▲ Fechar Setores' : '⚙️ Setores';
          });

          // Mudar Nível de Acesso (Gestor <-> Visualizador)
          card.querySelector('.role-select-input').addEventListener('change', async (e) => {
            const readonlyValue = parseInt(e.target.value);
            try {
              const res = await fetch(`/api/users/${user.id}/readonly`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_readonly: readonlyValue })
              });
              if (res.ok) {
                 showToast('Nível de acesso atualizado!');
                 // Recarrega o card para travar/destravar os toggles de modificação dos setores
                 setTimeout(loadUsersList, 300); 
              } else {
                 throw new Error();
              }
            } catch (err) {
              alert('Erro ao alterar nível.');
              e.target.value = readonlyValue === 1 ? "0" : "1";
            }
          });

          // Ver aba TODOS
          card.querySelector('.allow-all-tabs-checkbox').addEventListener('change', async (e) => {
            const val = e.target.checked ? 1 : 0;
            try {
              const res = await fetch(`/api/users/${user.id}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allow_all_tabs: val })
              });
              if (!res.ok) throw new Error();
            } catch (err) {
              e.target.checked = !e.target.checked;
            }
          });

          // Editar Celulares
          card.querySelector('.allow-edit-devices-checkbox').addEventListener('change', async (e) => {
            const val = e.target.checked ? 1 : 0;
            try {
              const res = await fetch(`/api/users/${user.id}/edit-devices`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allow_edit_devices: val })
              });
              if (!res.ok) throw new Error();
              showToast('Permissão de editar celulares atualizada!');
            } catch (err) {
              e.target.checked = !e.target.checked;
              alert('Erro ao atualizar permissão de editar celulares.');
            }
          });

          // Cadastrar Gestores
          card.querySelector('.allow-manage-users-checkbox').addEventListener('change', async (e) => {
            const val = e.target.checked ? 1 : 0;
            try {
              const res = await fetch(`/api/users/${user.id}/manage-users`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allow_manage_users: val })
              });
              if (!res.ok) throw new Error();
              showToast('Permissão de cadastrar gestores atualizada!');
            } catch (err) {
              e.target.checked = !e.target.checked;
              alert('Erro ao atualizar permissão de cadastrar gestores.');
            }
          });

          // Visualizar Dashboard
          card.querySelector('.allow-dashboard-checkbox').addEventListener('change', async (e) => {
            const val = e.target.checked ? 1 : 0;
            try {
              const res = await fetch(`/api/users/${user.id}/dashboard`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allow_dashboard: val })
              });
              if (!res.ok) throw new Error();
              showToast('Permissão de visualizar dashboard atualizada!');
            } catch (err) {
              e.target.checked = !e.target.checked;
              alert('Erro ao atualizar permissão de dashboard.');
            }
          });

          // Ativar/Desativar Conta
          card.querySelector('.is-active-checkbox').addEventListener('change', async (e) => {
            const val = e.target.checked ? 1 : 0;
            try {
              const res = await fetch(`/api/users/${user.id}/active`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: val })
              });
              if (res.ok) {
                if (val === 0) card.classList.add('inactive-manager-card');
                else card.classList.remove('inactive-manager-card');
              } else {
                throw new Error();
              }
            } catch (err) {
              e.target.checked = !e.target.checked;
            }
          });
          
          // Função para Auto-Salvar mudanças nos toggles de Setor
          const saveSectorPermissions = async () => {
             const permissions = [];
             availableSectors.forEach(sec => {
                const viewCb = card.querySelector(`.sector-view-cb[data-sector="${sec}"]`);
                const confCb = card.querySelector(`.sector-config-cb[data-sector="${sec}"]`);
                if(viewCb && confCb) {
                    permissions.push({
                        sector: sec,
                        can_view: viewCb.checked ? 1 : 0,
                        can_configure: confCb.checked ? 1 : 0
                    });
                }
             });
             
             try {
                const res = await fetch(`/api/users/${user.id}/permissions/sectors`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ permissions })
                });
                if(res.ok) {
                   showToast(`Permissões do setor salvas.`);
                }
             } catch(err) {
                 console.error("Erro ao auto-salvar setor.");
             }
          };

          // Ligar o Auto-Salvar a todos os checkboxes de setor deste card
          card.querySelectorAll('.sector-view-cb, .sector-config-cb').forEach(cb => {
              cb.addEventListener('change', saveSectorPermissions);
          });
        }

        manageUsersCardsContainer.appendChild(card);
      }
    } catch (err) {
      console.error('Erro ao carregar lista de gestores:', err);
    }
  }


  formManageUsers.addEventListener('submit', async (e) => {
    e.preventDefault();
    manageUsersErrorMsg.textContent = '';
    
    const name = document.getElementById('new-user-name').value.trim();
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value;
    const isReadonly = document.getElementById('new-user-readonly').checked ? 1 : 0;
    const allowEditDevices = document.getElementById('new-user-edit-devices').checked ? 1 : 0;
    const allowManageUsers = document.getElementById('new-user-manage-users').checked ? 1 : 0;
    const newRamalEl = document.getElementById('new-user-ramal');
    const ramal = newRamalEl ? newRamalEl.value.trim() : '';

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          name, 
          username, 
          password, 
          is_readonly: isReadonly, 
          ramal, 
          allow_edit_devices: allowEditDevices, 
          allow_manage_users: allowManageUsers,
          allow_dashboard: document.getElementById('new-user-dashboard').checked ? 1 : 0
        })
      });
      const data = await response.json();
      
      if (response.ok) {
        formManageUsers.reset();
        await loadUsersList();
        await loadSystemUsersList(); // Recarregar dropdown de reservas
      } else {
        manageUsersErrorMsg.textContent = data.error || 'Erro ao cadastrar gestor.';
      }
    } catch (err) {
      console.error('Erro no cadastro de gestor:', err);
      manageUsersErrorMsg.textContent = 'Erro ao enviar requisição.';
    }
  });

  // Mostrar/Ocultar switches de permissão se for visualizador no cadastro de novo gestor
  const newUserReadonlyCheckbox = document.getElementById('new-user-readonly');
  if (newUserReadonlyCheckbox) {
    newUserReadonlyCheckbox.addEventListener('change', (e) => {
      const editDevicesWrapper = document.getElementById('new-user-edit-devices')?.closest('.switch-container');
      const manageUsersWrapper = document.getElementById('new-user-manage-users')?.closest('.switch-container');
      
      if (e.target.checked) {
        if (editDevicesWrapper) editDevicesWrapper.style.display = 'none';
        if (manageUsersWrapper) manageUsersWrapper.style.display = 'none';
        // Desmarcar
        const cbEdit = document.getElementById('new-user-edit-devices');
        const cbManage = document.getElementById('new-user-manage-users');
        if (cbEdit) cbEdit.checked = false;
        if (cbManage) cbManage.checked = false;
      } else {
        if (editDevicesWrapper) editDevicesWrapper.style.display = 'flex';
        if (manageUsersWrapper) manageUsersWrapper.style.display = 'flex';
      }
    });
  }

  async function deleteUser(id, name) {
    if (confirm(`Deseja mesmo remover a gestora/gestor "${name}" do sistema?`)) {
      try {
        const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        if (response.ok) {
          await loadUsersList();
        } else {
          const data = await response.json();
          alert(data.error || 'Erro ao remover gestor.');
        }
      } catch (err) {
        console.error('Erro ao remover gestor:', err);
      }
    }
  }

  // --- Alternância de Abas do Modal de Gerenciamento ---
  const manageUsersTabs = document.getElementById('manage-users-tabs');
  if (manageUsersTabs) {
    manageUsersTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      
      document.querySelectorAll('#manage-users-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tabName = btn.getAttribute('data-manage-tab');
      
      document.getElementById('manage-users-section-users').style.display = tabName === 'users' ? 'block' : 'none';
      document.getElementById('manage-users-section-collaborators').style.display = tabName === 'collaborators' ? 'block' : 'none';
      document.getElementById('manage-users-section-updates').style.display = tabName === 'updates' ? 'block' : 'none';
    });
  }

  // Listeners de busca nas abas de gerenciamento
  if (searchManagersInput) {
    searchManagersInput.addEventListener('input', debounce((e) => {
      managerSearchQuery = e.target.value.toLowerCase().trim();
      filterManagerCards();
    }, 200));
  }
  if (searchCollaboratorsInput) {
    searchCollaboratorsInput.addEventListener('input', debounce((e) => {
      collaboratorSearchQuery = e.target.value.toLowerCase().trim();
      filterCollaboratorCards();
    }, 200));
  }

  // Filtro de Papel/Nível do Gestor (Pills)
  const roleFilterGroup = document.getElementById('filter-manager-role-group');
  if (roleFilterGroup) {
    roleFilterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-pill-btn');
      if (!btn) return;
      roleFilterGroup.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      managerRoleFilter = btn.getAttribute('data-role-filter') || 'all';
      filterManagerCards();
    });
  }

  function filterManagerCards() {
    const cards = manageUsersCardsContainer.querySelectorAll('.manager-card');
    cards.forEach(card => {
      const name = (card.getAttribute('data-user-name') || '').toLowerCase();
      const username = (card.getAttribute('data-user-username') || '').toLowerCase();
      const role = card.getAttribute('data-role') || 'gestores';
      const matchesSearch = !managerSearchQuery || name.includes(managerSearchQuery) || username.includes(managerSearchQuery);
      const matchesRole = managerRoleFilter === 'all' || role === managerRoleFilter;
      card.style.display = (matchesSearch && matchesRole) ? '' : 'none';
    });
  }

  // Filtro de Setores dos Colaboradores (Pills)
  const sectorFiltersBar = document.getElementById('collab-sector-filters-bar');
  if (sectorFiltersBar) {
    sectorFiltersBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.collab-sector-pill');
      if (!btn) return;
      sectorFiltersBar.querySelectorAll('.collab-sector-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      collaboratorSectorFilter = btn.getAttribute('data-sector-filter') || 'all';
      filterCollaboratorCards();
    });
  }

  function filterCollaboratorCards() {
    if (!manageCollaboratorsCardsContainer) return;
    const cards = manageCollaboratorsCardsContainer.querySelectorAll('.collab-mini-card');
    let visibleCount = 0;
    cards.forEach(card => {
      const name = (card.getAttribute('data-colab-name') || '').toLowerCase();
      const ramal = (card.getAttribute('data-colab-ramal') || '').toLowerCase();
      const sector = card.getAttribute('data-colab-sector') || '';
      const matchSearch = !collaboratorSearchQuery || name.includes(collaboratorSearchQuery) || ramal.includes(collaboratorSearchQuery);
      const matchSector = collaboratorSectorFilter === 'all' || sector.toLowerCase() === collaboratorSectorFilter.toLowerCase();
      const match = matchSearch && matchSector;
      card.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    const countEl = document.getElementById('collab-filtered-count');
    if (countEl) countEl.textContent = visibleCount;
  }

  function applyCollaboratorSectorScope() {
    const permittedSectors = currentUser &&
      currentUser.username !== 'vicenzzo' &&
      currentUser.allowAllTabs !== 1 &&
      currentUser.allowAllTabs !== true
      ? (currentUser.sectorPermissions || [])
        .filter(permission => permission.can_view === 1)
        .map(permission => permission.sector)
      : null;

    document.querySelectorAll('#collab-sector-filters-bar .collab-sector-pill').forEach(button => {
      const sector = button.getAttribute('data-sector-filter');
      const allowed = permittedSectors === null || sector === 'all' || permittedSectors.includes(sector);
      button.style.display = allowed ? '' : 'none';
    });

    ['new-colab-sector', 'edit-colab-sector'].forEach(selectId => {
      const select = document.getElementById(selectId);
      if (!select) return;
      Array.from(select.options).forEach(option => {
        option.hidden = permittedSectors !== null && !permittedSectors.includes(option.value);
      });
    });

    if (permittedSectors !== null && !permittedSectors.includes(collaboratorSectorFilter)) {
      collaboratorSectorFilter = 'all';
      const allButton = document.querySelector('#collab-sector-filters-bar [data-sector-filter="all"]');
      if (allButton) {
        document.querySelectorAll('#collab-sector-filters-bar .collab-sector-pill').forEach(button => button.classList.remove('active'));
        allButton.classList.add('active');
      }
    }
  }

  async function loadCollaboratorsList() {
    try {
      applyCollaboratorSectorScope();
      const response = await fetch('/api/collaborators');
      if (!response.ok) throw new Error('Erro ao buscar colaboradores');
      const collaborators = await response.json();
      
      const tabBadge = document.getElementById('counter-tab-colabs');
      if (tabBadge) tabBadge.textContent = collaborators.length;

      if (!manageCollaboratorsCardsContainer) return;
      manageCollaboratorsCardsContainer.innerHTML = '';
      
      collaborators.forEach(colab => {
        const initials = colab.name
          ? colab.name.split(' ').slice(0, 2).map(n => n[0]).join('')
          : 'C';
           
        const card = document.createElement('div');
        card.className = 'collab-mini-card';
        card.setAttribute('data-colab-name', (colab.name || '').toLowerCase());
        card.setAttribute('data-colab-ramal', (colab.ramal || '').toLowerCase());
        card.setAttribute('data-colab-sector', colab.sector || '');
        
        const cleanRamal = colab.ramal ? colab.ramal.replace('realess-', '') : '';
        const ramalHtml = colab.ramal
          ? `<span class="collab-ramal-badge">📞 ${escapeHTML(cleanRamal)}</span>`
          : '';
        const sectorHtml = `<span class="collab-sector-tag">${escapeHTML(colab.sector || 'Geral')}</span>`;

        card.innerHTML = `
          <div class="collab-avatar">${escapeHTML(initials)}</div>
          <div class="collab-info">
            <div class="collab-name">${escapeHTML(colab.name)}</div>
            <div class="collab-meta-row">
              ${sectorHtml}
              ${ramalHtml}
            </div>
          </div>
          <div class="collab-actions">
            <button class="icon-btn btn-edit-colab" data-colab-id="${colab.id}" title="Editar Operador">✏️</button>
            <button class="icon-btn btn-delete-colab" data-colab-id="${colab.id}" title="Remover Operador" style="color: #ff4757;">🗑️</button>
          </div>
        `;

        card.querySelector('.btn-delete-colab').addEventListener('click', () => {
          deleteCollaborator(colab.id, colab.name);
        });

        card.querySelector('.btn-edit-colab').addEventListener('click', () => {
          editCollaborator(colab.id, colab.name, colab.ramal || '', colab.sector || 'Junior');
        });

        manageCollaboratorsCardsContainer.appendChild(card);
      });

      filterCollaboratorCards();
    } catch (err) {
      console.error('Erro ao carregar lista de colaboradores:', err);
    }
  }

  function openModalEditColaborador() {
    openModal(modalEditColaborador);
  }

  function closeModalEditColaborador() {
    closeModal(modalEditColaborador);
  }

  function editCollaborator(id, name, ramal, sector) {
    editingColabId = id;
    editColabName.value = name;
    editColabRamal.value = ramal;
    const sectorEl = document.getElementById('edit-colab-sector');
    if (sectorEl) sectorEl.value = sector || 'Junior';
    if (editColabErrorMsg) editColabErrorMsg.textContent = '';
    openModalEditColaborador();
  }

  if (formEditColaborador) {
    formEditColaborador.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (editColabErrorMsg) editColabErrorMsg.textContent = '';

      const name = editColabName.value.trim();
      const ramal = editColabRamal.value.trim();
      const sectorEl = document.getElementById('edit-colab-sector');
      const sector = sectorEl ? sectorEl.value : 'Junior';

      if (!name) {
        if (editColabErrorMsg) editColabErrorMsg.textContent = 'Nome é obrigatório.';
        return;
      }

      try {
        const res = await fetch(`/api/collaborators/${editingColabId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, ramal, sector })
        });
        const data = await res.json();

        if (res.ok) {
          closeModalEditColaborador();
          await loadCollaboratorsList();
          await loadSystemUsersList();
          renderDevices();
        } else {
          if (editColabErrorMsg) editColabErrorMsg.textContent = data.error || 'Erro ao editar colaborador.';
        }
      } catch (err) {
        console.error('Erro ao editar colaborador:', err);
        if (editColabErrorMsg) editColabErrorMsg.textContent = 'Erro de conexão.';
      }
    });
  }

  async function deleteCollaborator(id, name) {
    if (confirm(`Deseja mesmo remover o usuário (celular) "${name}" do sistema?`)) {
      try {
        const response = await fetch(`/api/collaborators/${id}`, { method: 'DELETE' });
        if (response.ok) {
          await loadCollaboratorsList();
          await loadSystemUsersList();
          renderDevices();
        } else {
          const data = await response.json();
          alert(data.error || 'Erro ao remover colaborador.');
        }
      } catch (err) {
        console.error('Erro ao remover colaborador:', err);
      }
    }
  }

  if (formManageCollaborators) {
    formManageCollaborators.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (manageColabsErrorMsg) manageColabsErrorMsg.textContent = '';
      
      const name = document.getElementById('new-colab-name').value.trim();
      const ramal = document.getElementById('new-colab-ramal').value.trim();
      const sectorEl = document.getElementById('new-colab-sector');
      const sector = sectorEl ? sectorEl.value : 'Junior';

      try {
        const response = await fetch('/api/collaborators', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, ramal, sector })
        });
        const data = await response.json();
        
        if (response.ok) {
          formManageCollaborators.reset();
          await loadCollaboratorsList();
          await loadSystemUsersList();
          renderDevices();
        } else {
          if (manageColabsErrorMsg) manageColabsErrorMsg.textContent = data.error || 'Erro ao cadastrar usuário.';
        }
      } catch (err) {
        console.error('Erro no cadastro de colaborador:', err);
        if (manageColabsErrorMsg) manageColabsErrorMsg.textContent = 'Erro ao enviar requisição.';
      }
    });
  }

  // --- Funções Adicionadas (Busca de Usuários, Toast, Lupa e Setores) ---
  
  async function loadSystemUsersList() {
    try {
      const response = await fetch('/api/users/list');
      if (response.ok) {
        systemUsers = await response.json();
        renderDevices(); // Trigger re-render to apply collaborator names and sectors!
      }
    } catch (err) {
      console.error('Erro ao buscar lista de usuários para seleção:', err);
    }
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-success-icon">✔️</span>
      <span>${escapeHTML(message)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 3000);
  }

  function openSelectHolderModal(numberId, currentHolder) {
    selectHolderNumberId = numberId;
    const searchInput = document.getElementById('search-holder-input');
    searchInput.value = '';
    
    renderSelectHolderList('');
    openModal(modalSelectHolder);
    
    setTimeout(() => {
      searchInput.focus();
    }, 100);
  }

  function renderSelectHolderList(query) {
    if (!selectHolderList) return;
    selectHolderList.innerHTML = '';
    
    const lowercaseQuery = query.toLowerCase().trim();
    const filtered = systemUsers.filter(u => u.name.toLowerCase().includes(lowercaseQuery));
    
    if (filtered.length === 0) {
      selectHolderList.innerHTML = `<li style="text-align: center; color: var(--text-secondary); cursor: default;">Nenhum usuário encontrado</li>`;
      return;
    }
    
    filtered.forEach(u => {
      const li = document.createElement('li');
      li.textContent = u.name;
      li.addEventListener('click', () => {
        if (selectHolderNumberId) {
          const currentList = holderLists.get(selectHolderNumberId) || [];
          if (!currentList.includes(u.name)) {
            currentList.push(u.name);
            holderLists.set(selectHolderNumberId, currentList);
            const holderString = currentList.join(', ');
            sendWSMessage('UPDATE_NUMBER_HOLDER', { numberId: selectHolderNumberId, holder: holderString, versao: getNumberVersion(selectHolderNumberId) });
          }
        }
        closeModal(modalSelectHolder);
      });
      selectHolderList.appendChild(li);
    });
  }



  // --- Registro de Listeners ---

  if (searchInput) {
    // PERF: debounce de 250ms — evita re-render completo a cada tecla digitada
    const onSearch = debounce((e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderDevices();
    }, 250);
    searchInput.addEventListener('input', onSearch);
  }

  if (subsectorTabs) {
    subsectorTabs.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-pill')) {
        document.querySelectorAll('#subsector-tabs .filter-pill').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        currentSubSector = e.target.getAttribute('data-subsector');
        renderDevices();
      }
    });
  }



  if (formSystemUpdate) {
    formSystemUpdate.addEventListener('submit', (e) => {
      e.preventDefault();
      const file = updateZipFile.files[0];
      if (!file) return;
      
      updateErrorMsg.textContent = '';
      updateSuccessMsg.textContent = '';
      updateProgressContainer.style.display = 'block';
      updateStatusText.textContent = 'Enviando arquivo ZIP...';
      updatePercentage.textContent = '0%';
      updateProgressBar.style.width = '0%';
      btnSubmitUpdate.disabled = true;
      
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/update');
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          updatePercentage.textContent = `${percentComplete}%`;
          updateProgressBar.style.width = `${percentComplete}%`;
        }
      };
      
      xhr.onload = () => {
        btnSubmitUpdate.disabled = false;
        if (xhr.status === 200) {
          updateStatusText.textContent = 'Extraindo e aplicando atualização...';
          updateProgressBar.style.width = '100%';
          updatePercentage.textContent = '100%';
          updateSuccessMsg.textContent = 'Atualização aplicada com sucesso! O sistema irá reiniciar.';
          
          setTimeout(() => {
            window.location.reload();
          }, 5000);
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            updateErrorMsg.textContent = res.error || 'Erro desconhecido durante a atualização.';
          } catch (e) {
            updateErrorMsg.textContent = 'Erro de servidor ao processar atualização.';
          }
        }
      };
      
      xhr.onerror = () => {
        btnSubmitUpdate.disabled = false;
        updateErrorMsg.textContent = 'Erro de conexão de rede durante o upload.';
      };
      
      xhr.send(file);
    });
  }

  if (searchHolderInput) {
    searchHolderInput.addEventListener('input', debounce((e) => {
      renderSelectHolderList(e.target.value);
    }, 200));
  }

  function clearAllFiltersAndShow(targetDevice) {
    // 1. Limpar busca
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    
    // 2. Limpar status filter
    currentFilter = 'all';
    document.querySelectorAll('.filter-pill').forEach(btn => {
      if (btn.getAttribute('data-filter') === 'all') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 3. Limpar apenas reservas checkbox
    showOnlyReservas = false;
    const filterReservasCheckbox = document.getElementById('filter-reservas-checkbox');
    if (filterReservasCheckbox) filterReservasCheckbox.checked = false;
    
    // 4. Setar setor correspondente ao aparelho
    if (targetDevice) {
      if (targetDevice.sector === 'PA FIXA 1' || targetDevice.sector === 'PA FIXA 2') {
        currentSector = 'PA FIXA';
        currentSubSector = targetDevice.sector;
      } else {
        currentSector = targetDevice.sector;
      }
      persistCurrentSector();
      syncSectorTabsUI();
    }
    
    // Re-renderizar aparelhos para garantir que o aparelho de destino esteja presente
    renderDevices();
  }

  function normalizeHolderName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function isReservaNumber(device, number) {
    return Boolean(
      device?.name?.toLowerCase().includes('reserva') ||
      number?.name?.toLowerCase().includes('reserva')
    );
  }

  function findPrincipalForHolder(holderName) {
    const holderKey = normalizeHolderName(holderName);
    if (!holderKey) return null;

    return devicesData
      .filter(device => !device.name?.toLowerCase().includes('reserva'))
      .flatMap(device => (device.numbers || []).map(number => ({ device, number })))
      .find(({ device, number }) => {
        if (isReservaNumber(device, number)) return false;
        return (
          normalizeHolderName(number.name) === holderKey ||
          normalizeHolderName(device.name) === holderKey ||
          normalizeHolderName(getNegotiatorName(device, number)) === holderKey
        );
      }) || null;
  }

  function findReservaForPrincipal(device, number) {
    const principalName = normalizeHolderName(
      getNegotiatorName(device, number) || number?.name || device?.name
    );
    if (!principalName) return null;

    return devicesData
      .flatMap(reservaDevice => (reservaDevice.numbers || []).map(reservaNumber => ({
        device: reservaDevice,
        number: reservaNumber
      })))
      .find(({ device: reservaDevice, number: reservaNumber }) => {
        if (!isReservaNumber(reservaDevice, reservaNumber) || !reservaNumber.holder) {
          return false;
        }
        return reservaNumber.holder
          .split(',')
          .some(holder => normalizeHolderName(holder) === principalName);
      }) || null;
  }

  function scrollAndHighlight(targetId) {
    const targetRow = document.getElementById(`number-row-${targetId}`);
    if (targetRow) {
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetRow.classList.add('reserva-highlighted');
      setTimeout(() => {
        targetRow.classList.remove('reserva-highlighted');
      }, 3000);
    }
  }

  // Clique no badge de reserva — scroll até o número da reserva e destaca
  devicesContainer.addEventListener('click', (e) => {
    const badge = e.target.closest('.reserva-link-badge');
    if (!badge) return;
    const targetId = badge.getAttribute('data-reserva-number-id');
    if (!targetId) return;

    document.querySelectorAll('.number-row.reserva-highlighted').forEach(r => {
      r.classList.remove('reserva-highlighted');
    });

    const targetIdInt = parseInt(targetId);
    const targetDevice = devicesData.find(d => d.numbers && d.numbers.some(n => n.id === targetIdInt));

    clearAllFiltersAndShow(targetDevice);
    scrollAndHighlight(targetId);
  });

  // Clique no balão de restrito sem reserva — scroll até o número correspondente e destaca
  const sidebarContainer = document.getElementById('restricted-sidebar');
  if (sidebarContainer) {
    sidebarContainer.addEventListener('click', (e) => {
      const balloon = e.target.closest('.restricted-balloon');
      if (!balloon) return;
      const targetId = balloon.getAttribute('data-number-id');
      if (!targetId) return;

      document.querySelectorAll('.number-row.reserva-highlighted').forEach(r => {
        r.classList.remove('reserva-highlighted');
      });

      const targetIdInt = parseInt(targetId);
      const targetDevice = devicesData.find(d => d.numbers && d.numbers.some(n => n.id === targetIdInt));

      if (targetDevice) {
        clearAllFiltersAndShow(targetDevice);
        scrollAndHighlight(targetId);
      }
    });
  }

  // Clique no nome do responsável — mostra toast das reservas e scrolla até o chip principal
  devicesContainer.addEventListener('click', (e) => {
    const link = e.target.closest('.holder-name-link');
    if (!link) return;
    const holderName = link.getAttribute('data-holder-name');
    if (!holderName) return;

    document.querySelectorAll('.number-row.reserva-highlighted').forEach(r => {
      r.classList.remove('reserva-highlighted');
    });

    // Mostrar toast com a lista de reservas que o colaborador é responsável
    if (holderChips.has(holderName)) {
      const chips = holderChips.get(holderName);
      let chipList = chips.map(c =>
        `${escapeHTML(c.deviceName)}: ${escapeHTML(c.chipName)}`
      ).join(', ');
      showToast(`${holderName} é responsável por: ${chipList}`);
    }

    const principal = findPrincipalForHolder(holderName);

    if (principal) {
      clearAllFiltersAndShow(principal.device);
      scrollAndHighlight(principal.number.id);
    } else {
      // Fallback: se não tiver chip principal cadastrado, tenta rolar para a primeira reserva associada
      if (holderChips.has(holderName)) {
        const chips = holderChips.get(holderName);
        const firstChipId = chips[0]?.numberId;
        if (firstChipId) {
          const fallbackDevice = devicesData.find(d => d.numbers && d.numbers.some(n => n.id === firstChipId));
          if (fallbackDevice) {
            clearAllFiltersAndShow(fallbackDevice);
            scrollAndHighlight(firstChipId);
          }
        }
      }
    }
  });

  // Clique no nome do chip: alterna entre o aparelho principal e a reserva vinculada.
  devicesContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-name-display');
    if (!chip || e.target.closest('.reserva-link-badge')) return;

    const row = chip.closest('.number-row');
    const numberId = Number(row?.id?.replace('number-row-', ''));
    if (!numberId) return;

    const current = devicesData
      .flatMap(device => (device.numbers || []).map(number => ({ device, number })))
      .find(item => item.number.id === numberId);
    if (!current) return;

    const target = isReservaNumber(current.device, current.number)
      ? findPrincipalForHolder(current.number.holder?.split(',')[0])
      : findReservaForPrincipal(current.device, current.number);
    if (!target) return;

    e.stopPropagation();
    clearAllFiltersAndShow(target.device);
    scrollAndHighlight(target.number.id);
  });

  // --- Funções de Gráficos e Telemetria do Dashboard ---
  if (btnOpenDashboard) {
    btnOpenDashboard.addEventListener('click', () => {
      currentDashboardSector = 'all';
      currentDashboardPeriod = 'all';
      if (dashboardFilterSector) dashboardFilterSector.value = 'all';
      if (dashboardFilterPeriod) dashboardFilterPeriod.value = 'all';
      
      // Resetar para aba analítica
      if (btnDashTabAnalytics) btnDashTabAnalytics.classList.add('active');
      if (btnDashTabDiagnostics) btnDashTabDiagnostics.classList.remove('active');
      if (dashTabContentAnalytics) dashTabContentAnalytics.style.display = 'block';
      if (dashTabContentDiagnostics) dashTabContentDiagnostics.style.display = 'none';

      // Resetar toggle de visualização do duelo
      if (btnDuelViewOps && btnDuelViewAudit) {
        btnDuelViewOps.classList.add('active');
        btnDuelViewAudit.classList.remove('active');
        if (duelContainerOperators) duelContainerOperators.style.display = 'grid';
        if (duelContainerAuditors) duelContainerAuditors.style.display = 'none';
      }

      openModal(modalDashboard);
      initDashboardCharts();
      loadDashboardData();
      startDashboardPing();
    });
  }

  // Event Listeners das Abas do Dashboard
  if (btnDashTabAnalytics && btnDashTabDiagnostics) {
    btnDashTabAnalytics.addEventListener('click', () => {
      btnDashTabAnalytics.classList.add('active');
      btnDashTabDiagnostics.classList.remove('active');
      if (dashTabContentAnalytics) dashTabContentAnalytics.style.display = 'block';
      if (dashTabContentDiagnostics) dashTabContentDiagnostics.style.display = 'none';
    });

    btnDashTabDiagnostics.addEventListener('click', () => {
      btnDashTabDiagnostics.classList.add('active');
      btnDashTabAnalytics.classList.remove('active');
      if (dashTabContentAnalytics) dashTabContentAnalytics.style.display = 'none';
      if (dashTabContentDiagnostics) dashTabContentDiagnostics.style.display = 'block';
    });
  }

  if (dashboardFilterSector) {
    dashboardFilterSector.addEventListener('change', (e) => {
      currentDashboardSector = e.target.value;
      loadDashboardData();
    });
  }

  if (dashboardFilterPeriod) {
    dashboardFilterPeriod.addEventListener('change', (e) => {
      currentDashboardPeriod = e.target.value;
      loadDashboardData();
    });
  }

  // Toggle do Duelo: Operadores vs Auditores
  if (btnDuelViewOps && btnDuelViewAudit) {
    btnDuelViewOps.addEventListener('click', () => {
      btnDuelViewOps.classList.add('active');
      btnDuelViewAudit.classList.remove('active');
      if (duelContainerOperators) duelContainerOperators.style.display = 'grid';
      if (duelContainerAuditors) duelContainerAuditors.style.display = 'none';
    });

    btnDuelViewAudit.addEventListener('click', () => {
      btnDuelViewAudit.classList.add('active');
      btnDuelViewOps.classList.remove('active');
      if (duelContainerOperators) duelContainerOperators.style.display = 'none';
      if (duelContainerAuditors) duelContainerAuditors.style.display = 'block';
    });
  }

  if (btnExportDashboardPdf) {
    btnExportDashboardPdf.addEventListener('click', () => {
      exportDashboardToPdf();
    });
  }

  function startDashboardPing() {
    stopDashboardPing();
    sendPing();
    pingInterval = setInterval(sendPing, 10000);
  }

  function stopDashboardPing() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  function sendPing() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      lastPingTime = Date.now();
      socket.send(JSON.stringify({ type: 'PING', timestamp: lastPingTime }));
    }
  }

  function updateAgentTelemetry(data) {
    if (!data) return;
    
    if (agentIndicator) {
      if (data.connected) {
        agentIndicator.className = 'agent-indicator online';
        agentIndicator.textContent = 'Agente Local: Online';
      } else {
        agentIndicator.className = 'agent-indicator offline';
        agentIndicator.textContent = 'Agente Local: Desconectado';
      }
    }
    
    if (agentStatusDaemon) {
      agentStatusDaemon.textContent = data.connected ? 'Ativo' : 'Inativo';
      agentStatusDaemon.className = `badge-status ${data.connected ? 'ativo' : 'inativo'}`;
    }
    
    if (agentStatusWs) {
      agentStatusWs.textContent = data.connected ? 'Conectado' : 'Desconectado';
      agentStatusWs.className = `badge-status ${data.connected ? 'ativo' : 'inativo'}`;
    }
    
    if (agentLastHeartbeat) {
      if (data.lastHeartbeat > 0) {
        agentLastHeartbeat.textContent = new Date(data.lastHeartbeat).toLocaleString('pt-BR');
      } else {
        agentLastHeartbeat.textContent = '--';
      }
    }
    
    if (agentTokenStatus) {
      agentTokenStatus.textContent = data.connected ? 'realess-agent-token (Autenticado)' : 'Não detectado';
      agentTokenStatus.style.color = data.connected ? 'var(--status-free)' : 'var(--text-secondary)';
    }

    if (kpiMessagesTotal) {
      kpiMessagesTotal.textContent = data.msgCountToday || 0;
    }

    if (kpiMessagesRate) {
      kpiMessagesRate.textContent = `Taxa: ${data.msgsLastMinute || 0} / min`;
    }
  }

  function updateThroughputData(payload) {
    if (!payload) return;
    if (kpiMessagesTotal) kpiMessagesTotal.textContent = payload.totalToday || 0;
    if (kpiMessagesRate) kpiMessagesRate.textContent = `Taxa: ${payload.msgsLastMinute || 0} / min`;
    
    if (modalDashboard && modalDashboard.classList.contains('active') && chartThroughputInstance) {
      const timeStr = new Date(payload.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      throughputLabels.push(timeStr);
      throughputDataPoints.push(payload.msgsLastMinute || 0);
      
      if (throughputLabels.length > 20) {
        throughputLabels.shift();
        throughputDataPoints.shift();
      }
      
      chartThroughputInstance.update();
    }
  }

  function initDashboardCharts() {
    if (chartStatusInstance) { chartStatusInstance.destroy(); chartStatusInstance = null; }
    if (chartHorasInstance) { chartHorasInstance.destroy(); chartHorasInstance = null; }
    if (chartThroughputInstance) { chartThroughputInstance.destroy(); chartThroughputInstance = null; }
    if (chartAtritoInstance) { chartAtritoInstance.destroy(); chartAtritoInstance = null; }
    
    throughputLabels = [];
    throughputDataPoints = [];
    for (let i = 19; i >= 0; i--) {
      const d = new Date(Date.now() - i * 5000);
      throughputLabels.push(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      throughputDataPoints.push(0);
    }

    // Gráfico 1: Anatomia dos Bloqueios (Doughnut UIX)
    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    chartStatusInstance = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: ['Restrição 7 Dias', 'Restrição 24 Horas', 'Banimento Definitivo', 'Restrições Expiradas', 'Liberações Limpas'],
        datasets: [{
          data: [0, 0, 0, 0, 0],
          backgroundColor: ['#a855f7', '#fb923c', '#ff4757', '#f43f5e', '#2ed573'],
          borderColor: '#10121d',
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'right', 
            labels: { 
              boxWidth: 10, 
              color: '#cbd5e1',
              padding: 12,
              font: { family: "'Outfit', sans-serif", size: 11, weight: 600 } 
            } 
          }
        },
        cutout: '72%'
      }
    });

    // Gráfico 2: Volumetria Horária de Atrito (Line UIX)
    const ctxHoras = document.getElementById('chartHoras').getContext('2d');
    chartHorasInstance = new Chart(ctxHoras, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Incidentes registrados',
          data: [],
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { 
            grid: { color: 'rgba(255,255,255,0.04)' }, 
            ticks: { color: '#94a3b8', stepSize: 1, font: { family: "'Outfit', sans-serif", size: 10 } },
            min: 0
          },
          x: { 
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: "'Outfit', sans-serif", size: 10 } }
          }
        }
      }
    });

    // Gráfico 3: Throughput de Mensagens (Tempo Real UIX)
    const ctxThroughput = document.getElementById('chart-throughput').getContext('2d');
    chartThroughputInstance = new Chart(ctxThroughput, {
      type: 'line',
      data: {
        labels: throughputLabels,
        datasets: [{
          label: 'Mensagens/Minuto',
          data: throughputDataPoints,
          borderColor: '#818cf8',
          backgroundColor: 'rgba(129, 140, 248, 0.12)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointBackgroundColor: '#818cf8',
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 9 }, maxRotation: 45, minRotation: 45 }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 10 }, stepSize: 1 },
            min: 0
          }
        }
      }
    });

    // Gráfico 4: Atrito por Aparelho (Bar UIX)
    const ctxAtrito = document.getElementById('chart-atrito').getContext('2d');
    chartAtritoInstance = new Chart(ctxAtrito, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: 'rgba(255, 71, 87, 0.75)',
          borderColor: '#ff4757',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#a0aec0', font: { family: 'Outfit', size: 10 }, stepSize: 1 },
            min: 0
          },
          y: {
            grid: { display: false },
            ticks: { color: '#a0aec0', font: { family: 'Outfit', size: 10 } }
          }
        }
      },
      plugins: [
        {
          id: 'barLabels',
          afterDatasetsDraw(chart, args, options) {
            const { ctx, data } = chart;
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            chart.getDatasetMeta(0).data.forEach((bar, index) => {
              const val = data.datasets[0].data[index];
              if (val > 0) {
                const xPos = bar.x > 35 ? (bar.x / 2) : (bar.x + 15);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(val, xPos, bar.y);
              }
            });
            ctx.restore();
          }
        }
      ]
    });
  }

  async function loadDashboardData() {
    try {
      const res = await fetch(`/api/dashboard/stats?sector=${currentDashboardSector}&period=${currentDashboardPeriod}&_t=${Date.now()}`);
      if (!res.ok) throw new Error('Falha ao obter dados');
      const stats = await res.json();
      latestDashboardStats = stats;

      // Atualizar KPIs superiores do Esfera Analytics
      if (valTotalBloqueios) valTotalBloqueios.textContent = stats.totalBloqueios !== undefined ? stats.totalBloqueios : '--';
      if (valTotalMutacoes) valTotalMutacoes.textContent = stats.totalMutacoes !== undefined ? stats.totalMutacoes : '--';
      if (valTotalContingencia) valTotalContingencia.textContent = stats.totalContingencia !== undefined ? stats.totalContingencia : '--';

      // Atualizar KPIs secundários da automação
      if (kpiLifespan) kpiLifespan.textContent = stats.avgLifespan || '--';
      if (kpiBurnRate) kpiBurnRate.textContent = stats.burnRateHours || '--';
      if (kpiMttr) kpiMttr.textContent = stats.avgMttr || '--';

      // =========================================================================
      // RENDERIZAR RADAR DE ATRITO: HALL DA FAMA & ESQUADRÃO BLINDADO
      // =========================================================================

      // 1. Banner de Inteligência Tática
      if (duelIntelText && stats.resumoDuelo) {
        duelIntelText.innerHTML = stats.resumoDuelo.intelMessage || 'Monitoramento de atrito operacional ativo.';
      }

      // 2. Termômetro do Duelo
      if (stats.resumoDuelo) {
        if (valAtritoPct) valAtritoPct.textContent = (stats.resumoDuelo.atritoWeight || 50) + '%';
        if (valPreservacaoPct) valPreservacaoPct.textContent = (stats.resumoDuelo.preservacaoWeight || 50) + '%';
        if (duelBarAtrito) duelBarAtrito.style.width = (stats.resumoDuelo.atritoWeight || 50) + '%';
        if (duelBarPreservacao) duelBarPreservacao.style.width = (stats.resumoDuelo.preservacaoWeight || 50) + '%';
      }

      // 3. Destruidores de Chips (Mais Banem)
      if (listTopBanidores && stats.topBanidores) {
        listTopBanidores.innerHTML = '';
        stats.topBanidores.forEach(op => {
          const initials = op.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'OP';
          let posClass = 'pos-other';
          let medal = `${op.rank}º`;
          if (op.rank === 1) { posClass = 'pos-1'; medal = '🥇'; }
          else if (op.rank === 2) { posClass = 'pos-2'; medal = '🥈'; }
          else if (op.rank === 3) { posClass = 'pos-3'; medal = '🥉'; }

          const diretosCount = op.bansDiretos !== undefined ? op.bansDiretos : (op.totalBans - (op.reservasUsadas || 0));
          const tooltipDetail = `${diretosCount} bloqueios diretos + ${op.reservasUsadas || 0} por uso de reserva`;

          const item = document.createElement('div');
          item.className = 'operator-rank-item';
          item.innerHTML = `
            <div class="op-rank-header">
              <div class="op-rank-pos ${posClass}">${medal}</div>
              <div class="op-avatar-initials">${initials}</div>
              <div class="op-info-col">
                <div class="op-name">
                  <span>${op.name}</span>
                  <span class="op-sector-pill">${op.sector}</span>
                </div>
                <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                  Restr. 24h: <strong>${op.bans24h}</strong> • Restr. 7d: <strong>${op.bans7d}</strong> • Def: <strong>${op.bansDefinitivo}</strong> • Reservas Usadas: <strong>${op.reservasUsadas}</strong>
                </div>
              </div>
              <div class="op-metrics-right" title="${tooltipDetail}">
                <div class="op-main-metric" style="color: #ff4757;">${op.totalBans}</div>
                <div class="op-metric-sub">Quedas / Bloqueios</div>
              </div>
            </div>
            <div class="op-progress-bar-bg">
              <div class="op-progress-bar-fill" style="width: ${op.riskIndex || 50}%; background: linear-gradient(90deg, #ffa502, #ff4757);"></div>
            </div>
            <div class="op-rank-footer">
              <span class="op-badge-tag tag-danger">${op.badge}</span>
              <span style="color: #ff6b81; font-weight: 600;">${op.title}</span>
              <span>Sobrevivência: <strong style="color: #fff;">${op.survivalRate}</strong></span>
            </div>
          `;
          listTopBanidores.appendChild(item);
        });
      }

      // 4. Esquadrão Blindado (Menos Banem)
      if (listTopGuardioes && stats.topGuardioes) {
        listTopGuardioes.innerHTML = '';
        stats.topGuardioes.forEach(op => {
          const initials = op.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'OP';
          let posClass = 'pos-other';
          let medal = `${op.rank}º`;
          if (op.rank === 1) { posClass = 'pos-1'; medal = '🏆'; }
          else if (op.rank === 2) { posClass = 'pos-2'; medal = '🌟'; }
          else if (op.rank === 3) { posClass = 'pos-3'; medal = '💎'; }

          const activeInfo = op.hasActiveChip 
            ? `<span style="color: #2ed573; font-weight: 600;">📱 Chip Ativo em Linha</span>` 
            : `<span style="color: var(--text-secondary);">🛡️ Linha Preservada</span>`;

          const diretosCount = op.bansDiretos !== undefined ? op.bansDiretos : (op.totalBans - (op.reservasUsadas || 0));
          const tooltipDetail = `${diretosCount} bloqueios diretos + ${op.reservasUsadas || 0} por uso de reserva`;

          const item = document.createElement('div');
          item.className = 'operator-rank-item';
          item.innerHTML = `
            <div class="op-rank-header">
              <div class="op-rank-pos ${posClass}">${medal}</div>
              <div class="op-avatar-initials">${initials}</div>
              <div class="op-info-col">
                <div class="op-name">
                  <span>${op.name}</span>
                  <span class="op-sector-pill">${op.sector}</span>
                </div>
                <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                  ${activeInfo} • Reservas Usadas: <strong>${op.reservasUsadas}</strong>
                </div>
              </div>
              <div class="op-metrics-right" title="${tooltipDetail}">
                <div class="op-main-metric" style="color: #2ed573;">${op.totalBans}</div>
                <div class="op-metric-sub">Quedas / Bloqueios</div>
              </div>
            </div>
            <div class="op-progress-bar-bg">
              <div class="op-progress-bar-fill" style="width: ${op.survivalRate}; background: linear-gradient(90deg, #00d2d3, #2ed573);"></div>
            </div>
            <div class="op-rank-footer">
              <span class="op-badge-tag tag-success">${op.badge}</span>
              <span style="color: #7bed9f; font-weight: 600;">${op.title}</span>
              <span>Sobrevivência: <strong style="color: #2ed573;">${op.survivalRate}</strong></span>
            </div>
          `;
          listTopGuardioes.appendChild(item);
        });
      }

      // 5. Trilha de Auditores
      if (listTopAuditoresTbody && stats.auditoresRank) {
        listTopAuditoresTbody.innerHTML = '';
        if (stats.auditoresRank.length === 0) {
          listTopAuditoresTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhuma trava aplicada por auditores no período selecionado.</td></tr>`;
        } else {
          stats.auditoresRank.forEach((aud, idx) => {
            let posMedal = `${idx + 1}º`;
            if (idx === 0) posMedal = '🥇 1º';
            else if (idx === 1) posMedal = '🥈 2º';
            else if (idx === 2) posMedal = '🥉 3º';

            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${posMedal}</strong></td>
              <td><strong>${aud.user_name}</strong></td>
              <td><strong style="color: #7289da; font-size: 1.05rem;">${aud.count}</strong> travas aplicadas</td>
              <td><span class="badge ${aud.user_name.toLowerCase().includes('vicenzzo') ? 'master' : 'manager'}">${aud.user_name.toLowerCase().includes('vicenzzo') ? 'MASTER' : 'GESTOR/AUDITOR'}</span></td>
              <td><span class="badge" style="background: rgba(46, 213, 115, 0.15); color: #2ed573;">Ativo no CRM</span></td>
            `;
            listTopAuditoresTbody.appendChild(tr);
          });
        }
      }

      // Gráfico de Anatomia dos Bloqueios
      if (chartStatusInstance && stats.anatomiaStats) {
        chartStatusInstance.data.datasets[0].data = [
          stats.anatomiaStats['Restrição 7 dias'] || 0,
          stats.anatomiaStats['Restrição 24 horas'] || 0,
          stats.anatomiaStats['Banimento Definitivo'] || 0,
          stats.anatomiaStats['Restrições Expiradas'] || 0,
          stats.anatomiaStats['Liberações Limpas'] || 0
        ];
        chartStatusInstance.update();
      }

      // Gráfico de Volumetria Horária de Atrito
      if (chartHorasInstance && stats.chartHorasLabels && stats.chartHorasData) {
        chartHorasInstance.data.labels = stats.chartHorasLabels;
        chartHorasInstance.data.datasets[0].data = stats.chartHorasData;
        chartHorasInstance.update();
      }

      // Gráfico de Atrito por Aparelho (Top 5)
      if (chartAtritoInstance && stats.atritoRows) {
        const labels = stats.atritoRows.map(r => r.device_name);
        const counts = stats.atritoRows.map(r => r.count);
        chartAtritoInstance.data.labels = labels;
        chartAtritoInstance.data.datasets[0].data = counts;
        chartAtritoInstance.update();
      }

      // Renderizar Ranks: Operadores (Novo Tema UIX)
      if (rankOperadoresTbody && stats.rankOperadores) {
        rankOperadoresTbody.innerHTML = '';
        stats.rankOperadores.forEach((op, idx) => {
          let badgeClass = 'badge';
          if (op.rbac === 'MASTER') badgeClass = 'badge master';
          else if (op.rbac === 'MANAGER') badgeClass = 'badge manager';
          else if (op.rbac === 'AUDITOR') badgeClass = 'badge auditor';

          const initials = (op.name || 'OP')
            .split(/\s+/)
            .map(w => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <div class="table-op-cell">
                <div class="table-op-avatar">${initials}</div>
                <div>
                  <div class="table-op-name">${op.name}</div>
                  <div style="font-size: 0.65rem; color: var(--text-secondary);">#${idx + 1} no ranking de atividade</div>
                </div>
              </div>
            </td>
            <td style="text-align: center;">
              <span class="table-metric-badge metric-primary">⚡ ${op.count}</span>
            </td>
            <td style="text-align: right;">
              <span class="${badgeClass}">${op.rbac}</span>
            </td>
          `;
          rankOperadoresTbody.appendChild(tr);
        });
      }

      // Renderizar Ranks: Top Chips Afetados (Novo Tema UIX)
      if (rankChipsTbody && stats.rankChips) {
        rankChipsTbody.innerHTML = '';
        stats.rankChips.forEach(chip => {
          const isMartyr = chip.statusAlvo.includes('Mártir') || chip.statusAlvo.includes('Banido') || chip.count >= 3;
          const badgeClass = isMartyr ? 'metric-danger' : 'metric-primary';

          let statusBadgeStyle = 'background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12);';
          if (chip.statusAlvo.includes('Banido') || chip.statusAlvo.includes('Mártir')) {
            statusBadgeStyle = 'background: rgba(255, 71, 87, 0.15); color: #ff4757; border: 1px solid rgba(255, 71, 87, 0.3);';
          } else if (chip.statusAlvo.includes('24h') || chip.statusAlvo.includes('24 Horas')) {
            statusBadgeStyle = 'background: rgba(253, 150, 68, 0.15); color: #fd9644; border: 1px solid rgba(253, 150, 68, 0.3);';
          } else if (chip.statusAlvo.includes('7d') || chip.statusAlvo.includes('7 Dias')) {
            statusBadgeStyle = 'background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3);';
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <span class="table-phone-chip">📱 ${chip.phone}</span>
            </td>
            <td style="text-align: center;">
              <span class="table-metric-badge ${badgeClass}">🔥 ${chip.count}</span>
            </td>
            <td style="text-align: right;">
              <span style="font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; ${statusBadgeStyle}">${chip.statusAlvo}</span>
            </td>
          `;
          rankChipsTbody.appendChild(tr);
        });
      }

      // Renderizar Diagnósticos do Core (Novo Tema UIX)
      if (dashAlertsContainer && stats.diagnosticos) {
        dashAlertsContainer.innerHTML = '';
        stats.diagnosticos.forEach(diag => {
          const div = document.createElement('div');
          div.className = `alert-item ${diag.type === 'danger' ? 'danger' : 'warning'}`;
          div.innerHTML = `
            <div class="alert-icon">${diag.icon}</div>
            <div class="alert-body" style="flex: 1;">
              <h5>
                <span>${diag.title}</span>
                <span class="badge ${diag.type === 'danger' ? 'badge-danger' : 'badge-warning'}" style="margin-left: auto; font-size: 0.65rem; background: ${diag.type === 'danger' ? 'rgba(255,71,87,0.2)' : 'rgba(253,150,68,0.2)'}; color: ${diag.type === 'danger' ? '#ff4757' : '#fd9644'}; border: 1px solid ${diag.type === 'danger' ? 'rgba(255,71,87,0.4)' : 'rgba(253,150,68,0.4)'};">${diag.type === 'danger' ? 'CRÍTICO' : 'ATENÇÃO'}</span>
              </h5>
              <p>${diag.description}</p>
              <div class="technical-fix">
                <code>$ ${diag.fix}</code>
                <span style="font-size: 0.65rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">AÇÃO RECOMENDADA</span>
              </div>
            </div>
          `;
          dashAlertsContainer.appendChild(div);
        });
      }

      // Contador de Diagnósticos
      if (dashDiagnosticsCount && stats.diagnosticos) {
        dashDiagnosticsCount.textContent = stats.diagnosticos.length;
      }

    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
    }
  }

  // Função para exportar o relatório executivo completo em PDF
  async function exportDashboardToPdf() {
    if (!latestDashboardStats) {
      showToast('Aguarde os dados do dashboard carregarem para exportar.', 'warning');
      return;
    }

    showToast('Gerando relatório executivo em PDF...', 'info');

    const stats = latestDashboardStats;
    const now = new Date();
    const dataHoraStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const periodLabelMap = {
      'all': 'Todo o Período Histórico',
      '24h': 'Últimas 24 Horas',
      '7d': 'Últimos 7 Dias',
      '30d': 'Últimos 30 Dias'
    };
    const periodLabel = periodLabelMap[currentDashboardPeriod] || currentDashboardPeriod;
    const sectorLabel = currentDashboardSector === 'all' ? 'Todos os Setores' : `Setor ${currentDashboardSector}`;
    const emissor = currentUser ? (currentUser.name || currentUser.username) : 'Gestão de Celulares';

    // Criar o container do relatório formatado
    const report = document.createElement('div');
    report.id = 'pdf-report-document';
    report.style.width = '750px';
    report.style.padding = '24px 28px';
    report.style.background = '#ffffff';
    report.style.color = '#1e293b';
    report.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    report.style.boxSizing = 'border-box';
    report.style.fontSize = '12px';
    report.style.lineHeight = '1.4';

    // Top Banidores Rows
    const topBanidoresHtml = (stats.topBanidores && stats.topBanidores.length > 0)
      ? stats.topBanidores.map((op, i) => `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6px 8px; font-weight: bold; text-align: center; color: #dc2626;">#${op.rank}</td>
          <td style="padding: 6px 8px; font-weight: 600;">${op.name}</td>
          <td style="padding: 6px 8px;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">${op.sector}</span></td>
          <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #dc2626; font-size: 13px;">${op.totalBans}</td>
          <td style="padding: 6px 8px; text-align: center; color: #64748b; font-size: 11px;">${op.bans24h} / ${op.bans7d} / ${op.bansDefinitivo}</td>
          <td style="padding: 6px 8px; text-align: center; color: #64748b;">${op.reservasUsadas}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: 600; color: #e11d48;">${op.survivalRate}</td>
          <td style="padding: 6px 8px;"><span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">${op.badge}</span></td>
        </tr>
      `).join('')
      : `<tr><td colspan="8" style="padding: 12px; text-align: center; color: #64748b;">Nenhum bloqueio registrado no filtro selecionado.</td></tr>`;

    // Top Guardiões Rows
    const topGuardioesHtml = (stats.topGuardioes && stats.topGuardioes.length > 0)
      ? stats.topGuardioes.map((op, i) => `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6px 8px; font-weight: bold; text-align: center; color: #059669;">#${op.rank}</td>
          <td style="padding: 6px 8px; font-weight: 600;">${op.name}</td>
          <td style="padding: 6px 8px;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">${op.sector}</span></td>
          <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #059669; font-size: 13px;">${op.totalBans}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: 600; color: #059669;">${op.survivalRate}</td>
          <td style="padding: 6px 8px; text-align: center; font-size: 11px;">${op.hasActiveChip ? '<span style="color: #059669; font-weight: 600;">📱 Ativo (' + (op.activePhone || 'Sim') + ')</span>' : '<span style="color: #64748b;">Blindado</span>'}</td>
          <td style="padding: 6px 8px; text-align: center; color: #64748b;">${op.reservasUsadas}</td>
          <td style="padding: 6px 8px;"><span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">${op.badge}</span></td>
        </tr>
      `).join('')
      : `<tr><td colspan="8" style="padding: 12px; text-align: center; color: #64748b;">Nenhum operador encontrado.</td></tr>`;

    // Top Chips Rows
    const topChipsHtml = (stats.rankChips && stats.rankChips.length > 0)
      ? stats.rankChips.map(c => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 5px 8px; font-family: monospace; font-weight: 600;">${c.phone}</td>
          <td style="padding: 5px 8px; text-align: center; font-weight: bold; color: #dc2626;">${c.count}</td>
          <td style="padding: 5px 8px;"><span style="background: #fee2e2; color: #991b1b; padding: 1px 6px; border-radius: 3px; font-size: 10px;">${c.statusAlvo}</span></td>
        </tr>
      `).join('')
      : `<tr><td colspan="3" style="padding: 8px; text-align: center; color: #64748b;">Nenhum chip crítico.</td></tr>`;

    // Auditores Rows
    const auditoresHtml = (stats.auditoresRank && stats.auditoresRank.length > 0)
      ? stats.auditoresRank.map(a => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 5px 8px; font-weight: 600;">${a.user_name}</td>
          <td style="padding: 5px 8px; text-align: center; font-weight: bold; color: #2563eb;">${a.count}</td>
          <td style="padding: 5px 8px; font-size: 10px; color: #64748b;">Trava aplicada no CRM</td>
        </tr>
      `).join('')
      : `<tr><td colspan="3" style="padding: 8px; text-align: center; color: #64748b;">Nenhum auditor.</td></tr>`;

    report.innerHTML = `
      <!-- Cabeçalho Executivo -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">ESFERA CORE • BUSINESS INTELLIGENCE</div>
          <div style="font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Relatório de Auditoria, Atrito de Rede e Preservação de Linhas</div>
        </div>
        <div style="text-align: right; font-size: 10px; color: #64748b;">
          <div><strong>Emissão:</strong> ${dataHoraStr}</div>
          <div><strong>Setor:</strong> ${sectorLabel}</div>
          <div><strong>Filtro Temporal:</strong> ${periodLabel}</div>
          <div><strong>Emitido por:</strong> ${emissor}</div>
        </div>
      </div>

      <!-- Resumo de Inteligência Tática -->
      <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 10px 14px; border-radius: 4px; margin-bottom: 16px; font-size: 11px; color: #1e293b;">
        ${stats.resumoDuelo?.intelMessage || 'Monitoramento de atrito operacional ativo.'}
      </div>

      <!-- KPIs Estratégicos -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Atrito de Rede (Quedas)</div>
          <div style="font-size: 20px; font-weight: 900; color: #dc2626; margin-top: 2px;">${stats.totalBloqueios !== undefined ? stats.totalBloqueios : '--'}</div>
          <div style="font-size: 9px; color: #94a3b8;">Incidentes no Período</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Mutações de Sistema</div>
          <div style="font-size: 20px; font-weight: 900; color: #2563eb; margin-top: 2px;">${stats.totalMutacoes !== undefined ? stats.totalMutacoes : '--'}</div>
          <div style="font-size: 9px; color: #94a3b8;">Logs Transacionais</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Trocas de Contingência</div>
          <div style="font-size: 20px; font-weight: 900; color: #059669; margin-top: 2px;">${stats.totalContingencia !== undefined ? stats.totalContingencia : '--'}</div>
          <div style="font-size: 9px; color: #94a3b8;">Chips Reserva Alocados</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
          <div style="font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700;">Tempo de Recuperação</div>
          <div style="font-size: 20px; font-weight: 900; color: #7c3aed; margin-top: 2px;">${stats.avgMttr || '--'}</div>
          <div style="font-size: 9px; color: #94a3b8;">MTTR Médio de Linha</div>
        </div>
      </div>

      <!-- Balanço Duelo -->
      <div style="margin-bottom: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">
          <span style="color: #dc2626;">Atrito Humano: ${stats.resumoDuelo?.atritoWeight || 50}%</span>
          <span style="color: #059669;">Preservação Ativa: ${stats.resumoDuelo?.preservacaoWeight || 50}%</span>
        </div>
        <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; display: flex;">
          <div style="width: ${stats.resumoDuelo?.atritoWeight || 50}%; background: #dc2626; height: 100%;"></div>
          <div style="width: ${stats.resumoDuelo?.preservacaoWeight || 50}%; background: #059669; height: 100%;"></div>
        </div>
      </div>

      <!-- Tabela 1: Hall da Fama - Quem Mais Bane -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 12px; font-weight: 800; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>🔥 Hall da Fama: Operadores com Maior Índice de Bloqueios (Destruidores de Chips)</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 9px; color: #475569;">
              <th style="padding: 6px 8px; text-align: center; width: 35px;">Pos</th>
              <th style="padding: 6px 8px; text-align: left;">Operador</th>
              <th style="padding: 6px 8px; text-align: left;">Setor</th>
              <th style="padding: 6px 8px; text-align: center;">Total Bloqueios</th>
              <th style="padding: 6px 8px; text-align: center;">Restr. 24h / 7d / Def</th>
              <th style="padding: 6px 8px; text-align: center;">Reservas Usadas</th>
              <th style="padding: 6px 8px; text-align: center;">Sobrevivência</th>
              <th style="padding: 6px 8px; text-align: left;">Título Operacional</th>
            </tr>
          </thead>
          <tbody>
            ${topBanidoresHtml}
          </tbody>
        </table>
      </div>

      <!-- Tabela 2: Esquadrão Blindado - Quem Menos Bane -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 12px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
          <span>🛡️ Esquadrão Blindado: Operadores com Maior Preservação (Guardiões da Linha)</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 9px; color: #475569;">
              <th style="padding: 6px 8px; text-align: center; width: 35px;">Pos</th>
              <th style="padding: 6px 8px; text-align: left;">Operador</th>
              <th style="padding: 6px 8px; text-align: left;">Setor</th>
              <th style="padding: 6px 8px; text-align: center;">Total Bloqueios</th>
              <th style="padding: 6px 8px; text-align: center;">Sobrevivência</th>
              <th style="padding: 6px 8px; text-align: center;">Status do Chip</th>
              <th style="padding: 6px 8px; text-align: center;">Reservas Usadas</th>
              <th style="padding: 6px 8px; text-align: left;">Título Operacional</th>
            </tr>
          </thead>
          <tbody>
            ${topGuardioesHtml}
          </tbody>
        </table>
      </div>

      <!-- Seção Inferior: Top Chips & Auditores -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 5px;">📱 Top Chips Mais Afetados</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 9px; color: #475569;">
                <th style="padding: 5px 8px; text-align: left;">Número</th>
                <th style="padding: 5px 8px; text-align: center;">Quedas</th>
                <th style="padding: 5px 8px; text-align: left;">Diagnóstico</th>
              </tr>
            </thead>
            <tbody>
              ${topChipsHtml}
            </tbody>
          </table>
        </div>

        <div>
          <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 5px;">👮 Trilha de Auditores (Quem Travou)</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 9px; color: #475569;">
                <th style="padding: 5px 8px; text-align: left;">Gestor / Auditor</th>
                <th style="padding: 5px 8px; text-align: center;">Travas</th>
                <th style="padding: 5px 8px; text-align: left;">Papel</th>
              </tr>
            </thead>
            <tbody>
              ${auditoresHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Rodapé Corporativo -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #94a3b8;">
        <div>Esfera Core System • Relatório de Inteligência Gerencial e Controle de Hardware</div>
        <div>Documento Confidencial • Uso Interno Autorizado</div>
      </div>
    `;

    // Container overlay visível para garantir captura de tela não-branca com feedback em tempo real
    const overlay = document.createElement('div');
    overlay.id = 'pdf-export-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(10, 15, 30, 0.85); backdrop-filter: blur(8px); z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; overflow-y: auto; padding: 25px 10px; box-sizing: border-box;';

    const statusBanner = document.createElement('div');
    statusBanner.style.cssText = 'background: #1e293b; color: #ffffff; padding: 10px 20px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);';
    statusBanner.innerHTML = `
      <div style="width: 16px; height: 16px; border: 2px solid #ff4757; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span>Gerando documento PDF em alta resolução...</span>
    `;

    // Botões de ação no topo do relatório
    const actionToolbar = document.createElement('div');
    actionToolbar.style.cssText = 'display: flex; gap: 10px; margin-bottom: 14px;';
    actionToolbar.innerHTML = `
      <button id="btn-force-print" style="background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">🖨️ Imprimir / Salvar PDF Nativo</button>
      <button id="btn-close-pdf-overlay" style="background: #475569; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">✕ Fechar</button>
    `;

    overlay.appendChild(statusBanner);
    overlay.appendChild(actionToolbar);
    overlay.appendChild(report);
    document.body.appendChild(overlay);

    const btnForcePrint = actionToolbar.querySelector('#btn-force-print');
    const btnCloseOverlay = actionToolbar.querySelector('#btn-close-pdf-overlay');

    btnForcePrint.addEventListener('click', () => {
      printFallback(report.innerHTML);
    });

    btnCloseOverlay.addEventListener('click', () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    });

    const filename = `relatorio-esfera-${currentDashboardSector.toLowerCase().replace(/\\s+/g, '-')}-${currentDashboardPeriod}-${now.toISOString().slice(0, 10)}.pdf`;

    // Aguardar 150ms para renderização física e layout no DOM
    await new Promise(r => setTimeout(r, 150));

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [6, 6, 6, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      try {
        await html2pdf().set(opt).from(report).save();
        showToast('Relatório PDF exportado com sucesso!', 'success');
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
        }, 700);
      } catch (err) {
        console.error('Erro no html2pdf:', err);
        showToast('Erro ao exportar PDF via biblioteca. Abrindo assistente de impressão...', 'warning');
        printFallback(report.innerHTML);
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      }
    } else {
      printFallback(report.innerHTML);
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }
  }

  function printFallback(htmlContent) {
    const printWin = window.open('', '_blank', 'width=900,height=800');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Relatório Executivo Esfera Core</title>
            <style>
              body { margin: 0; padding: 20px; font-family: 'Inter', -apple-system, sans-serif; background: #fff; color: #1e293b; }
              @media print {
                body { padding: 0; }
                @page { margin: 8mm; size: A4 portrait; }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } else {
      window.print();
    }
  }

  // Lógica para tornar o restricted-sidebar arrastável usando as headers dos setores com sanitização e duplo clique para reset
  function makeSidebarDraggable() {
    const sidebar = document.getElementById('restricted-sidebar');
    if (!sidebar) return;

    function sanitizePosition(topStr, leftStr) {
      const topVal = parseFloat(topStr);
      const leftVal = parseFloat(leftStr);
      if (isNaN(topVal) || isNaN(leftVal)) return null;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const sidebarWidth = sidebar.offsetWidth || 260;
      const sidebarHeight = sidebar.offsetHeight || 150;

      // Deixar pelo menos 10px de margem das bordas da tela e não sobrepor o header (mínimo 75px)
      const maxLeft = Math.max(10, viewportWidth - sidebarWidth - 10);
      const maxTop = Math.max(75, viewportHeight - sidebarHeight - 10);

      const sanitizedLeft = Math.max(10, Math.min(leftVal, maxLeft));
      const sanitizedTop = Math.max(75, Math.min(topVal, maxTop));

      return { top: `${sanitizedTop}px`, left: `${sanitizedLeft}px` };
    }

    function applySavedPosition() {
      const savedPos = localStorage.getItem('restricted-sidebar-pos');
      if (savedPos) {
        try {
          const { top, left, isCustom } = JSON.parse(savedPos);
          if (isCustom) {
            const sanitized = sanitizePosition(top, left);
            if (sanitized) {
              sidebar.style.top = sanitized.top;
              sidebar.style.left = sanitized.left;
              sidebar.style.right = 'auto';
              sidebar.style.bottom = 'auto';
            } else {
              // Se as coordenadas gravadas forem inválidas, limpa o estilo para voltar ao padrão
              resetSidebarPosition();
            }
          }
        } catch (e) {
          console.error('Erro ao ler posição do sidebar:', e);
        }
      }
    }

    function resetSidebarPosition() {
      localStorage.removeItem('restricted-sidebar-pos');
      sidebar.style.top = '';
      sidebar.style.left = '';
      sidebar.style.right = '';
      sidebar.style.bottom = '';
    }

    // Aplicar a posição salva inicialmente
    applySavedPosition();

    // Reajustar se o tamanho da tela mudar (responsividade / rotação / mudança de monitor)
    window.addEventListener('resize', () => {
      const savedPos = localStorage.getItem('restricted-sidebar-pos');
      if (savedPos) {
        applySavedPosition();
      }
    });

    // Resetar ao dar duplo clique no cabeçalho do setor
    sidebar.addEventListener('dblclick', (e) => {
      const header = e.target.closest('.sidebar-sector-header');
      if (header) {
        resetSidebarPosition();
      }
    });

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    // Escutar eventos de mousedown no sidebar
    sidebar.addEventListener('mousedown', (e) => {
      // Verificar se o clique foi na header do setor ou em algo interno dela
      const header = e.target.closest('.sidebar-sector-header');
      if (!header) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = sidebar.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      // Desativar seleção de texto temporariamente e trocar o cursor
      document.body.style.userSelect = 'none';
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const sidebarWidth = sidebar.offsetWidth || 260;
      const sidebarHeight = sidebar.offsetHeight || 150;

      // Limitar o arrasto dentro da tela e abaixo do header
      newLeft = Math.max(10, Math.min(newLeft, viewportWidth - sidebarWidth - 10));
      newTop = Math.max(75, Math.min(newTop, viewportHeight - sidebarHeight - 10));

      sidebar.style.left = `${newLeft}px`;
      sidebar.style.top = `${newTop}px`;
      sidebar.style.right = 'auto';
      sidebar.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.userSelect = '';
      
      const headers = sidebar.querySelectorAll('.sidebar-sector-header');
      headers.forEach(h => {
        h.style.cursor = '';
      });

      // Salvar posição no localStorage
      localStorage.setItem('restricted-sidebar-pos', JSON.stringify({
        top: sidebar.style.top,
        left: sidebar.style.left,
        isCustom: true
      }));
    });
  }

  // Inicialização
  syncSectorTabsUI();
  window.addEventListener('focus', () => {
    restoreSavedSector(true);
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'veritas:selectedSector' || e.key === 'crm_selected_sector' || e.key === 'crm_selected_subsector') {
      restoreSavedSector(true);
    }
  });
  makeSidebarDraggable();
  checkAuth();
});

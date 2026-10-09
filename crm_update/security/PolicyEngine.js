const ROLES = { MASTER: 'MASTER', MANAGER: 'MANAGER', VIEWER: 'VIEWER' };

class PolicyEngine {
  static determineRole(user) {
    if (!user || user.is_active === 0) return null;
    if (user.role === 'MASTER') return ROLES.MASTER;
    if (user.is_readonly === 1) return ROLES.VIEWER;
    return ROLES.MANAGER;
  }

  static canManageUsers(user) {
    const role = this.determineRole(user);
    return role === ROLES.MASTER || (role === ROLES.MANAGER && user.allow_manage_users === 1);
  }

  static canConfigureSectorPermissions(user) {
    return this.determineRole(user) === ROLES.MASTER;
  }

  static canMutateTargetUser(currentUser, targetUser) {
    return this.determineRole(currentUser) === ROLES.MASTER && this.determineRole(targetUser) !== ROLES.MASTER;
  }

  static canWrite(user) { return [ROLES.MASTER, ROLES.MANAGER].includes(this.determineRole(user)); }

  static canEditDevices(user) {
    const role = this.determineRole(user);
    return role === ROLES.MASTER || (role === ROLES.MANAGER && user.allow_edit_devices === 1);
  }

  static canViewDashboard(user) {
    const role = this.determineRole(user);
    return role === ROLES.MASTER || (role === ROLES.MANAGER && user.allow_dashboard === 1);
  }

  static canWriteInSector(user, sector, permissions) {
    if (this.determineRole(user) === ROLES.MASTER) return true;
    if (this.determineRole(user) === ROLES.VIEWER) return false;
    if (!permissions || permissions.length === 0) return true;
    const permission = permissions.find(item => item.sector === sector);
    return Boolean(permission && permission.can_configure === 1);
  }

  static canViewSector(user, sector, permissions) {
    if (this.determineRole(user) === ROLES.MASTER) return true;
    if (!permissions || permissions.length === 0) return true;
    const permission = permissions.find(item => item.sector === sector);
    return Boolean(permission && permission.can_view === 1);
  }
}

module.exports = { PolicyEngine, ROLES };

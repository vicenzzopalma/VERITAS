const BaseRepository = require('./BaseRepository');

const NUMBER_SELECT_COLUMNS = 'id, device_id, phone_number, name, status, restricted_until, restricted_at, alarm_active, holder, versao, site_history_active, in_hand, veritas_status, veritas_last_seen, veritas_name, COALESCE(display_order, 0) AS display_order, criado_em, atualizado_em';

class NumberRepository extends BaseRepository {
  async getById(id) {
    return await this.db.get(
      `SELECT ${NUMBER_SELECT_COLUMNS} FROM numbers WHERE id = ? AND excluido_em IS NULL`,
      [id]
    );
  }

  async getAll() {
    return await this.db.all(
      `SELECT ${NUMBER_SELECT_COLUMNS} FROM numbers WHERE excluido_em IS NULL ORDER BY COALESCE(display_order, 0) ASC, id ASC`
    );
  }

  async getByDeviceId(deviceId) {
    return await this.db.all(
      `SELECT ${NUMBER_SELECT_COLUMNS} FROM numbers WHERE device_id = ? AND excluido_em IS NULL ORDER BY COALESCE(display_order, 0) ASC, id ASC`,
      [deviceId]
    );
  }

  async create({ deviceId, phoneNumber, name, status, holder }) {
    const nowStr = new Date().toISOString();
    return await this.db.run(
      'INSERT INTO numbers (device_id, phone_number, name, status, holder, versao, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      [deviceId, phoneNumber, name || 'Chip', status || 'Livre', holder || '', nowStr, nowStr]
    );
  }

  async updateHolder(id, holder, versao) {
    const nowStr = new Date().toISOString();
    const result = await this.db.run(
      'UPDATE numbers SET holder = ?, versao = versao + 1, atualizado_em = ? WHERE id = ? AND versao = ? AND excluido_em IS NULL',
      [holder, nowStr, id, versao]
    );
    if (result.changes === 0) {
      throw new Error('CONCURRENCY_ERROR: O chip foi modificado por outro usuário. Recarregue a página.');
    }
    return result;
  }

  async updateStatus(id, { status, restrictedUntil, restrictedAt, alarmActive, holder, versao }) {
    const nowStr = new Date().toISOString();
    const result = await this.db.run(
      'UPDATE numbers SET status = ?, restricted_until = ?, restricted_at = ?, alarm_active = ?, holder = ?, versao = versao + 1, atualizado_em = ? WHERE id = ? AND versao = ? AND excluido_em IS NULL',
      [status, restrictedUntil, restrictedAt, alarmActive, holder, nowStr, id, versao]
    );
    if (result.changes === 0) {
      throw new Error('CONCURRENCY_ERROR: O chip foi modificado por outro usuário. Recarregue a página.');
    }
    return result;
  }

  async confirmRelease(id, versao) {
    const nowStr = new Date().toISOString();
    const result = await this.db.run(
      "UPDATE numbers SET status = 'Livre', restricted_until = NULL, restricted_at = NULL, alarm_active = 0, versao = versao + 1, atualizado_em = ? WHERE id = ? AND versao = ? AND excluido_em IS NULL",
      [nowStr, id, versao]
    );
    if (result.changes === 0) {
      throw new Error('CONCURRENCY_ERROR: O chip foi modificado por outro usuário. Recarregue a página.');
    }
    return result;
  }

  async moveNumber(id, targetDeviceId, versao) {
    const nowStr = new Date().toISOString();
    const result = await this.db.run(
      'UPDATE numbers SET device_id = ?, versao = versao + 1, atualizado_em = ? WHERE id = ? AND versao = ? AND excluido_em IS NULL',
      [targetDeviceId, nowStr, id, versao]
    );
    if (result.changes === 0) {
      throw new Error('CONCURRENCY_ERROR: O chip foi modificado por outro usuário. Recarregue a página.');
    }
    return result;
  }

  async updateDetails(id, { name, phoneNumber, status, versao }) {
    const nowStr = new Date().toISOString();
    const result = await this.db.run(
      'UPDATE numbers SET name = ?, phone_number = ?, status = ?, versao = versao + 1, atualizado_em = ? WHERE id = ? AND versao = ? AND excluido_em IS NULL',
      [name, phoneNumber, status, nowStr, id, versao]
    );
    if (result.changes === 0) {
      throw new Error('CONCURRENCY_ERROR: O chip foi modificado por outro usuário. Recarregue a página.');
    }
    return result;
  }

  async updateNameAndHolder(id, { name, holder, versao }) {
    const nowStr = new Date().toISOString();
    const result = await this.db.run(
      'UPDATE numbers SET name = ?, holder = ?, versao = versao + 1, atualizado_em = ? WHERE id = ? AND versao = ? AND excluido_em IS NULL',
      [name, holder, nowStr, id, versao]
    );
    if (result.changes === 0) {
      throw new Error('CONCURRENCY_ERROR: O chip foi modificado por outro usuário. Recarregue a página.');
    }
    return result;
  }

  async updateFlags(id, { siteHistoryActive, inHand, versao }) {
    const nowStr = new Date().toISOString();
    const result = await this.db.run(
      'UPDATE numbers SET site_history_active = ?, in_hand = ?, versao = versao + 1, atualizado_em = ? WHERE id = ? AND versao = ? AND excluido_em IS NULL',
      [siteHistoryActive ? 1 : 0, inHand ? 1 : 0, nowStr, id, versao]
    );
    if (result.changes === 0) {
      throw new Error('CONCURRENCY_ERROR: O chip foi modificado por outro usuário. Recarregue a página.');
    }
    return result;
  }

  async delete(id, versao) {
    const nowStr = new Date().toISOString();
    const result = await this.db.run(
      'UPDATE numbers SET excluido_em = ?, atualizado_em = ?, versao = versao + 1 WHERE id = ? AND versao = ? AND excluido_em IS NULL',
      [nowStr, nowStr, id, versao]
    );
    if (result.changes === 0) {
      throw new Error('CONCURRENCY_ERROR: O chip foi removido ou modificado por outro usuário.');
    }
    return result;
  }

  async getExpiredRestrictedNumbers(nowIsoStr) {
    return await this.db.all(
      "SELECT id, device_id, phone_number, name, status, restricted_until, restricted_at, alarm_active, holder, versao FROM numbers WHERE (status LIKE 'Restrito%' OR status = 'Banido') AND restricted_until IS NOT NULL AND restricted_until <= ? AND alarm_active = 0 AND excluido_em IS NULL",
      [nowIsoStr]
    );
  }

  async activateAlarm(id) {
    const nowStr = new Date().toISOString();
    return await this.db.run(
      'UPDATE numbers SET alarm_active = 1, versao = versao + 1, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL',
      [nowStr, id]
    );
  }

  async updateVeritasStatus(id, { veritasStatus, veritasLastSeen, veritasName }) {
    const nowStr = new Date().toISOString();
    return await this.db.run(
      'UPDATE numbers SET veritas_status = ?, veritas_last_seen = ?, veritas_name = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL',
      [veritasStatus || 'OFFLINE', veritasLastSeen || nowStr, veritasName || '', nowStr, id]
    );
  }

  async reorderNumbers(deviceId, orderedNumberIds) {
    if (!Array.isArray(orderedNumberIds) || orderedNumberIds.length === 0) return;
    const nowStr = new Date().toISOString();
    await this.db.run('BEGIN TRANSACTION');
    try {
      for (let i = 0; i < orderedNumberIds.length; i++) {
        const numId = parseInt(orderedNumberIds[i], 10);
        if (!isNaN(numId)) {
          if (deviceId) {
            await this.db.run(
              'UPDATE numbers SET display_order = ?, atualizado_em = ? WHERE id = ? AND device_id = ?',
              [i, nowStr, numId, deviceId]
            );
          } else {
            await this.db.run(
              'UPDATE numbers SET display_order = ?, atualizado_em = ? WHERE id = ?',
              [i, nowStr, numId]
            );
          }
        }
      }
      await this.db.run('COMMIT');
    } catch (err) {
      await this.db.run('ROLLBACK');
      throw err;
    }
  }
}

module.exports = NumberRepository;

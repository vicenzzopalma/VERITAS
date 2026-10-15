const BaseRepository = require('./BaseRepository');

class DeviceRepository extends BaseRepository {
  async getById(id) {
    return await this.db.get(
      'SELECT id, name, sector, origin_sector, COALESCE(display_order, 0) AS display_order, criado_em, atualizado_em FROM devices WHERE id = ? AND excluido_em IS NULL',
      [id]
    );
  }

  async getAll() {
    return await this.db.all(
      'SELECT id, name, sector, origin_sector, COALESCE(display_order, 0) AS display_order, criado_em, atualizado_em FROM devices WHERE excluido_em IS NULL ORDER BY COALESCE(display_order, 0) ASC, name ASC'
    );
  }

  async create({ name, sector }) {
    const nowStr = new Date().toISOString();
    return await this.db.run(
      'INSERT INTO devices (name, sector, origin_sector, display_order, criado_em, atualizado_em) VALUES (?, ?, ?, 0, ?, ?)',
      [name, sector, sector, nowStr, nowStr]
    );
  }

  async update(id, { name, sector }) {
    const nowStr = new Date().toISOString();
    return await this.db.run(
      'UPDATE devices SET name = ?, sector = ?, origin_sector = ?, atualizado_em = ? WHERE id = ? AND excluido_em IS NULL',
      [name, sector, sector, nowStr, id]
    );
  }

  async reorderDevices(orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
    const nowStr = new Date().toISOString();
    await this.db.run('BEGIN TRANSACTION');
    try {
      for (let i = 0; i < orderedIds.length; i++) {
        const devId = parseInt(orderedIds[i], 10);
        if (!isNaN(devId)) {
          await this.db.run(
            'UPDATE devices SET display_order = ?, atualizado_em = ? WHERE id = ?',
            [i, nowStr, devId]
          );
        }
      }
      await this.db.run('COMMIT');
    } catch (err) {
      await this.db.run('ROLLBACK');
      throw err;
    }
  }

  async delete(id) {
    const nowStr = new Date().toISOString();
    // Soft delete do aparelho
    await this.db.run(
      'UPDATE devices SET excluido_em = ?, atualizado_em = ? WHERE id = ?',
      [nowStr, nowStr, id]
    );
    // Soft delete cascateado de todos os chips associados
    await this.db.run(
      'UPDATE numbers SET excluido_em = ?, atualizado_em = ? WHERE device_id = ? AND excluido_em IS NULL',
      [nowStr, nowStr, id]
    );
  }
}

module.exports = DeviceRepository;

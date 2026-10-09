import { QueryInterface, DataTypes } from "sequelize";

const sectors = ["PA FIXA 1", "PA FIXA 2", "Junior", "Senior", "Pesquisa", "Comercial", "Juridico"];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("Sectors", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      minimumProfile: { type: DataTypes.STRING, allowNull: false, defaultValue: "admin_operational" },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    const now = new Date();
    await queryInterface.bulkInsert("Sectors", sectors.map(name => ({
      name,
      minimumProfile: "admin_operational",
      active: true,
      createdAt: now,
      updatedAt: now
    })));

    await queryInterface.sequelize.query(
      "UPDATE UserSectorPermissions SET sector = 'Juridico' WHERE sector IN ('JurÃ­dico', 'Jurídico')"
    ).catch(() => {});
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("Sectors");
  }
};

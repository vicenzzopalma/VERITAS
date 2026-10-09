import { QueryInterface, DataTypes, Op } from "sequelize";

const sectors = ["PA FIXA 1", "PA FIXA 2", "Junior", "Senior", "Pesquisa", "Comercial", "Jurídico"];
const masterEmail = "vicenzzo.mastronikolis@realess.com.br";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("UserSectorPermissions", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
      },
      sector: { type: DataTypes.STRING, allowNull: false },
      canView: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      canConfigure: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex("UserSectorPermissions", ["userId", "sector"], {
      unique: true,
      name: "user_sector_permissions_user_sector_unique"
    });

    await queryInterface.sequelize.query(
      "UPDATE Users SET profile = 'admin_master' WHERE LOWER(email) = :email",
      { replacements: { email: masterEmail } }
    );
    await queryInterface.sequelize.query(
      "UPDATE Users SET profile = 'admin_operational' WHERE profile = 'admin' AND LOWER(email) <> :email",
      { replacements: { email: masterEmail } }
    );

    const [adminRows] = await queryInterface.sequelize.query(
      "SELECT id FROM Users WHERE profile IN ('admin_master', 'admin_operational')"
    ) as any;
    const now = new Date();
    const permissionRows: any[] = [];
    for (const row of adminRows || []) {
      for (const sector of sectors) {
        permissionRows.push({ userId: row.id, sector, canView: true, canConfigure: true, createdAt: now, updatedAt: now });
      }
    }
    if (permissionRows.length > 0) {
      await queryInterface.bulkInsert("UserSectorPermissions", permissionRows);
    }

    const [masterRows] = await queryInterface.sequelize.query(
      "SELECT id FROM Users WHERE LOWER(email) = :email",
      { replacements: { email: masterEmail } }
    ) as any;
    if (!masterRows || masterRows.length === 0) {
      const unusableHash = "$2a$12$1QW8jK2h7Vq7WmJ7m2h4eOq4l5B0QxP5oT8M9V0H4qP7r6X8S2Y3K";
      await queryInterface.bulkInsert("Users", [{
        name: "Vicenzzo Mastronikolis",
        email: masterEmail,
        passwordHash: unusableHash,
        profile: "admin_master",
        status: "pending",
        canAccessConnections: true,
        connectionSectors: JSON.stringify(sectors),
        tokenVersion: 0,
        createdAt: now,
        updatedAt: now
      }]);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("UserSectorPermissions", "user_sector_permissions_user_sector_unique").catch(() => {});
    await queryInterface.dropTable("UserSectorPermissions");
    await queryInterface.sequelize.query("UPDATE Users SET profile = 'admin' WHERE profile IN ('admin_master', 'admin_operational')");
  }
};

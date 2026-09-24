import { QueryInterface, DataTypes, Op } from "sequelize";

const defaultSectors = ["PA FIXA 1", "PA FIXA 2"];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.addColumn("Users", "canAccessConnections", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    } catch (e) {
      // Column may already exist on installations initialized from the model.
    }

    try {
      await queryInterface.addColumn("Users", "connectionSectors", {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
      });
    } catch (e) {
      // Column may already exist on installations initialized from the model.
    }

    await queryInterface.bulkUpdate(
      "Users",
      {
        canAccessConnections: true,
        connectionSectors: defaultSectors
      },
      { profile: "whatsapp_control" }
    );
    await queryInterface.bulkUpdate(
      "Users",
      { canAccessConnections: false, connectionSectors: [] },
      { profile: { [Op.ne]: "whatsapp_control" } }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Users", "connectionSectors");
    await queryInterface.removeColumn("Users", "canAccessConnections");
  }
};

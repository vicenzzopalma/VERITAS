import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.addColumn("Users", "status", {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "active"
      });
    } catch (e) {
      // column might already exist
    }
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Users", "status");
  }
};

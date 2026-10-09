import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "UPDATE Users SET profile = 'admin' WHERE profile IN ('admin_master', 'admin_operational')"
    );
  },

  down: async (_queryInterface: QueryInterface) => {
    // Reversão intencionalmente sem alteração: o estado original não distingue
    // quais usuários eram Master ou Operacional antes desta restauração.
  }
};

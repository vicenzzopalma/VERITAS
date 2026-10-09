import { Table, Column, Model, DataType, AllowNull, Default, Unique } from "sequelize-typescript";

@Table({ tableName: "Sectors" })
class Sector extends Model<Sector> {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  name: string;

  @AllowNull(false)
  @Default("admin_operational")
  @Column(DataType.STRING)
  minimumProfile: string;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  active: boolean;
}

export default Sector;

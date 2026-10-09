import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  Default,
  Unique
} from "sequelize-typescript";

@Table({ tableName: "Sectors" })
class Sector extends Model<Sector> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Unique
  @Column
  name: string;

  @Default("admin_operational")
  @Column
  minimumProfile: string;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Sector;
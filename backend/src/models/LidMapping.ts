import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AllowNull,
  Index
} from "sequelize-typescript";

@Table({ tableName: "LidMappings" })
class LidMapping extends Model<LidMapping> {
  @PrimaryKey
  @AllowNull(false)
  @Column
  lid: string;

  @Index
  @AllowNull(false)
  @Column
  phoneNumber: string;

  @Column
  whatsappId: number;

  @Column
  name: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default LidMapping;

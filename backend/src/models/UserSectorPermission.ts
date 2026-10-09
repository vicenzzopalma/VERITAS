import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import User from "./User";

@Table({ tableName: "UserSectorPermissions" })
class UserSectorPermission extends Model<UserSectorPermission> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column
  userId: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  sector: string;

  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  canView: boolean;

  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  canConfigure: boolean;

  @BelongsTo(() => User)
  user: User;
}

export default UserSectorPermission;

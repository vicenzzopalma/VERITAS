import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  Default,
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
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column
  sector: string;

  @Default(true)
  @Column
  canView: boolean;

  @Default(false)
  @Column
  canConfigure: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default UserSectorPermission;
declare namespace Express {
  export interface Request {
    user: {
      id: string;
      profile: string;
      email?: string;
      canAccessConnections?: boolean;
      connectionSectors?: string[];
      isMasterAdmin?: boolean;
      sectorPermissions?: Array<{
        sector: string;
        canView: boolean;
        canConfigure: boolean;
      }>;
    };
  }
}

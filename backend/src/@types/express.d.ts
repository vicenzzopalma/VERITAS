declare namespace Express {
  export interface Request {
    user: {
      id: string;
      email?: string;
      profile: string;
      canAccessConnections?: boolean;
      connectionSectors?: string[];
      sectorPermissions?: Array<{
        sector: string;
        canView: boolean;
        canConfigure: boolean;
      }>;
    };
  }
}
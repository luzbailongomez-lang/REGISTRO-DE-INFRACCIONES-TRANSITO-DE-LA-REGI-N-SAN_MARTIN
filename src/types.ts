export interface TrafficInfraction {
  ID_REGISTRO: string;
  ACTA: string;
  FECHA: string;
  HORA_INFRACCION: string;
  ID_PERSONA_DNI: string;
  D_INFRACCION: string;
  UBIGEO: string;
  DEPARTAMENTO: string;
  COD_PROVINCIA: string;
  PROVINCIA: string;
  COD_DISTRITO: string;
  DISTRITO: string;
  ALTITUD: string;
  LATITUD: string;
  LONGITUD: string;
  FECHA_CORTE: string;
}

export interface DashboardStats {
  totalInfractions: number;
  uniqueInfractors: number;
  topProvince: string;
  topInfractionType: string;
}

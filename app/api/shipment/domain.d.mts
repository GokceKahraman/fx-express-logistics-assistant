export type ShipmentLookup = {
  found: boolean;
  code?: string;
  trackingNumber?: string;
  status?: string;
  statusCode?: string;
  eta?: string | null;
  delay?: boolean;
  exception?: string | null;
  latestEvent?: string;
  sources?: string[];
  handoffRecommended: boolean;
};

export function lookupShipment(value: unknown): ShipmentLookup;

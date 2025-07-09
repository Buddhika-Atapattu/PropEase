declare module 'oui' {
  export interface OuiResult {
    registry: string;
    assignment: string;
    organization: string;
    organizationAddress: string;
  }

  function oui(mac: string): OuiResult | null;

  export = oui;
}
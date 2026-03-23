export type ExactSuiPayload = {
  /** Base64-encoded signed Sui transaction bytes */
  transaction: string;
  /** Base64-encoded transaction signature */
  signature: string;
};

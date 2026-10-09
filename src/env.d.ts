interface ImportMetaEnv {
  /** pi-dash public events API. Unset: the site shows no sessions (the poster points to the dashboard) and does not refresh. */
  readonly PUBLIC_EVENTS_URL?: string;
  /** Canonical origin, default https://proudindian.ngo */
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

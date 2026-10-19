interface ImportMetaEnv {
  /** pi-dash public events API. Unset: the site shows no sessions (the poster points to the dashboard) and does not refresh. */
  readonly PUBLIC_EVENTS_URL?: string;
  /** PostHog project API key (public). Unset: no product analytics. Sent only from proudindian.ngo itself. */
  readonly PUBLIC_POSTHOG_KEY?: string;
  /** Canonical origin, default https://proudindian.ngo */
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

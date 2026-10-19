/**
 * PostHog product analytics: page views and page leaves (time on page, scroll depth, page-to-page paths), clicks
 * (autocapture) and heatmaps. Runs only on the production host with PUBLIC_POSTHOG_KEY set, so local builds, the
 * behaviour QA and pages.dev previews send nothing.
 * Cookieless: no cookies or storage; PostHog's servers derive a daily visitor and session from a salted hash, which
 * needs "Cookieless server hash mode" on in the PostHog project settings. No remote config, flags or extra scripts
 * load, so the CSP only needs PostHog's ingestion host in connect-src.
 */
const KEY = import.meta.env.PUBLIC_POSTHOG_KEY?.trim();
const HOST = "proudindian.ngo";

export function initAnalytics() {
  if (!KEY || location.hostname !== HOST) return;
  const run = () =>
    import("posthog-js").then(({ default: posthog }) =>
      posthog.init(KEY, {
        api_host: "https://us.i.posthog.com",
        defaults: "2026-08-30",
        cookieless_mode: "always",
        capture_pageview: true,
        capture_pageleave: true,
        capture_heatmaps: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        disable_session_recording: true,
        disable_surveys: true,
        capture_dead_clicks: false,
        capture_performance: false,
        capture_exceptions: false,
      })
    );
  // the same timing as the modal preload: 2.5s after load, then the next idle moment, so the ~110 KB (gzip) library
  // never competes with the hero's load sequence
  const idle = () =>
    "requestIdleCallback" in window
      ? requestIdleCallback(run, { timeout: 5000 })
      : setTimeout(run, 0);
  const later = () => setTimeout(idle, 2500);
  if (document.readyState === "complete") later();
  else addEventListener("load", later, { once: true });
}

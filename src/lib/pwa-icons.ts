/** Bump when regenerating public PWA icon assets (cache bust for installed PWAs). */
export const PWA_ICON_VERSION = "2";

export const PWA_MANIFEST_PATH = `/manifest.json?v=${PWA_ICON_VERSION}`;

export const PWA_ICON_192_PATH = `/icon-192x192.png?v=${PWA_ICON_VERSION}`;

export const PWA_ICON_512_PATH = `/icon-512x512.png?v=${PWA_ICON_VERSION}`;

export const PWA_APPLE_TOUCH_ICON_PATH =
  `/apple-touch-icon.png?v=${PWA_ICON_VERSION}`;

export const PWA_FAVICON_PATH = `/favicon.png?v=${PWA_ICON_VERSION}`;

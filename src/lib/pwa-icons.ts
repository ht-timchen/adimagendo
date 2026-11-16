/** Bump when regenerating public PWA icon assets (cache bust for installed PWAs). */
export const PWA_ICON_VERSION = "4";

export const PWA_MANIFEST_PATH = `/manifest.json?v=${PWA_ICON_VERSION}`;

export const PWA_ICON_192_PATH = `/icons/rose/icon-192x192.png?v=${PWA_ICON_VERSION}`;

export const PWA_ICON_512_PATH = `/icons/rose/icon-512x512.png?v=${PWA_ICON_VERSION}`;

export const PWA_APPLE_TOUCH_ICON_PATH =
  `/icons/rose/apple-touch-icon.png?v=${PWA_ICON_VERSION}`;

export const PWA_FAVICON_PATH = `/icons/rose/favicon.png?v=${PWA_ICON_VERSION}`;

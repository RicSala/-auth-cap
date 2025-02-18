// See: https://developer.mozilla.org/es/docs/Web/Manifest

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `Test`,
    short_name: `Test`,
    description: `Test`,
    id: 'com.test.app',
    start_url: '/',
    display: 'standalone',
    display_override: ['standalone', 'window-controls-overlay', 'fullscreen'],
    background_color: '#fff',
    theme_color: '#fff',
    scope: '/', // which URL are within the navigation scope of your application. If the user navigates outside of your app's scope, the will be navigated to a normal browser window.
    lang: 'es',
    orientation: 'portrait',
    categories: ['veterinaria', 'notas', 'asistente', 'veterinario'],
    icons: [
      {
        src: '/images/icons/512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/icons/192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/icons/180.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/icons/32.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    launch_handler: {
      // @ts-ignore
      client_mode: 'navigate-existing',
    },
    dir: 'ltr',
    screenshots: [
      {
        src: '/images/screenshots/1.png',
        sizes: '1080x1920',
        type: 'image/png',
      },
      {
        src: '/images/screenshots/2.png',
        sizes: '1080x1920',
        type: 'image/png',
      },
      {
        src: '/images/screenshots/3.png',
        sizes: '1080x1920',
        type: 'image/png',
      },
      {
        src: '/images/screenshots/4.png',
        sizes: '1080x1920',
        type: 'image/png',
      },
      {
        src: '/images/screenshots/5.png',
        sizes: '1080x1920',
        type: 'image/png',
      },
      {
        src: '/images/screenshots/6.png',
        sizes: '1080x1920',
        type: 'image/png',
      },
    ],
    prefer_related_applications: false, // Prefer the web app (PWA)
    related_applications: [],
  };
}

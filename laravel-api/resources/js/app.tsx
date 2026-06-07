import '../css/app.css';
import './i18n';

import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import axios from 'axios';

window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

const appName = import.meta.env.VITE_APP_NAME || 'Stream';

createInertiaApp({
  title: (title) => title ? `${title} - ${appName}` : appName,
  resolve: (name) =>
    resolvePageComponent(
      `./pages/${name}.tsx`,
      import.meta.glob('./pages/**/*.tsx'),
    ),
  setup({ el, App, props }) {
    const root = createRoot(el);
    root.render(<App {...props} />);
  },
  progress: {
    color: '#4f46e5',
  },
});

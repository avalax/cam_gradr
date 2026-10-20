import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import { i18n } from './lang';
import { useLanguageStore } from './lang/language-store';
import './style.css';

const pinia = createPinia();
const app = createApp(App).use(pinia).use(i18n);
// Applies the saved language choice (or the browser language) to the page before it is shown.
useLanguageStore(pinia).apply();
app.mount('#app');

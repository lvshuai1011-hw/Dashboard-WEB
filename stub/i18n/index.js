import { createI18n } from 'vue-i18n';
import zh from './CN.js';
import en from './US.js';
export default createI18n({ globalInjection: true, legacy: false, locale: new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh', messages: { zh, en } });

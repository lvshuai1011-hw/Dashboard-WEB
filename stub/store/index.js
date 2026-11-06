import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
export const useLoginStore = defineStore('loginInfo', () => {
  const csrfWebToken = ref(sessionStorage.getItem('previewCsrf') || 'dev-csrf-token');
  const pathPrefix = computed(() => '/vds');
  return {
    getCsrfWebToken: computed(() => csrfWebToken.value),
    getterLanguage: computed(() => 'zh_CN'),
    pathPrefix,
  };
});
export const getTabPagePrefix = () => '';

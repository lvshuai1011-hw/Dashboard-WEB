import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
export const useLoginStore = defineStore('loginInfo', () => {
  let previewToken = 'dev-csrf-token';
  try {
    previewToken = sessionStorage.getItem('previewCsrf') || previewToken;
  } catch {
    /* 嵌入页面可能无法访问浏览器存储。 */
  }
  const csrfWebToken = ref(previewToken);
  const pathPrefix = computed(() => '/vds');
  return {
    getCsrfWebToken: computed(() => csrfWebToken.value),
    getterLanguage: computed(() => 'zh_CN'),
    pathPrefix,
  };
});
export const getTabPagePrefix = () => '';

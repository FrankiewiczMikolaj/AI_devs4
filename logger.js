/**
 * @param {string} scope — task name, e.g. "people"
 */
export const createLogger = (scope) => ({
  info: (message) => console.log(`[${scope}] ${message}`),
  cache: (message) => console.log(`[${scope}:cache] ${message}`),
  hub: (message) => console.log(`[hub] ${message}`),
  hubError: (message) => console.error(`[hub] ${message}`),
});

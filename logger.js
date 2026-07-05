/**
 * @param {string} scope — task name, e.g. "people"
 */
export const createLogger = (scope) => ({
  info: (message) => console.log(`[${scope}] ${message}`),
  data: (message) => console.log(`[${scope}:data] ${message}`),
  cache: (message) => console.log(`[${scope}:cache] ${message}`),
  output: (message) => console.log(`[${scope}:output] ${message}`),
  hub: (message) => console.log(`[hub] ${message}`),
  hubError: (message) => console.error(`[hub] ${message}`),
});

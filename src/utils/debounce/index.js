export function debounce(callbackFunction, delay = 250) {
  let timeout;

  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      callbackFunction(...args);
    }, delay);
  };
}
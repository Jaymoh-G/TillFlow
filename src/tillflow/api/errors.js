export class TillFlowApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {unknown} [data]
   */
  constructor(message, status, data = undefined) {
    super(message);
    this.name = 'TillFlowApiError';
    this.status = status;
    this.data = data;
  }
}

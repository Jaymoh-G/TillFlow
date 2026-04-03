import { tillflowFetch, tillflowUpload } from './client';

export function listProductsRequest(token) {
  return tillflowFetch('/products', { token });
}

/** Same payload as GET /products, but allowed with sales.manage only (for quotations / POS). */
export function listSalesCatalogProductsRequest(token) {
  return tillflowFetch('/sales/catalog-products', { token });
}

export function getProductRequest(token, id) {
  return tillflowFetch(`/products/${id}`, { token });
}

export function listTrashedProductsRequest(token) {
  return tillflowFetch('/products/trashed', { token });
}

export function createProductRequest(token, body) {
  return tillflowFetch('/products', { method: 'POST', token, body });
}

export function updateProductRequest(token, id, body) {
  return tillflowFetch(`/products/${id}`, { method: 'PATCH', token, body });
}

export function deleteProductRequest(token, id) {
  return tillflowFetch(`/products/${id}`, { method: 'DELETE', token });
}

export function restoreProductRequest(token, id) {
  return tillflowFetch(`/products/${id}/restore`, { method: 'POST', token });
}

/**
 * @param {string} token
 * @param {number|string} productId
 * @param {number|string} variantId
 * @param {File} imageFile
 */
export function uploadProductVariantImageRequest(token, productId, variantId, imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  return tillflowUpload(`/products/${productId}/variants/${variantId}/image`, {
    method: 'POST',
    token,
    formData,
  });
}

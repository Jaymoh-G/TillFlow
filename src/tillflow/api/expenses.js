import { tillflowFetch, tillflowUpload } from "./client";

export function listExpensesRequest(token, params = {}) {
  const q = new URLSearchParams();
  for (const k of ["q", "category_id", "customer_id", "payment_status", "payment_mode", "from", "to"]) {
    const v = params[k];
    if (v != null && String(v) !== "") {
      q.set(k, String(v));
    }
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return tillflowFetch(`/expenses${suffix}`, { token });
}

export function createExpenseRequest(token, body) {
  return tillflowFetch("/expenses", { method: "POST", token, body });
}

export function updateExpenseRequest(token, id, body) {
  return tillflowFetch(`/expenses/${encodeURIComponent(String(id))}`, { method: "PATCH", token, body });
}

export function deleteExpenseRequest(token, id) {
  return tillflowFetch(`/expenses/${encodeURIComponent(String(id))}`, { method: "DELETE", token });
}

function buildExpenseFormData(fields, receiptFile) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields || {})) {
    if (v === undefined) continue;
    if (v === null) {
      fd.append(k, "");
      continue;
    }
    fd.append(k, String(v));
  }
  if (receiptFile instanceof Blob) {
    fd.append("receipt", receiptFile, `receipt-${Date.now()}`);
  }
  return fd;
}

export function createExpenseMultipartRequest(token, fields, receiptFile) {
  return tillflowUpload("/expenses", {
    method: "POST",
    token,
    formData: buildExpenseFormData(fields, receiptFile)
  });
}

export function updateExpenseMultipartRequest(token, id, fields, receiptFile) {
  return tillflowUpload(`/expenses/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    token,
    formData: buildExpenseFormData(fields, receiptFile)
  });
}

export function listExpenseCategoriesRequest(token) {
  return tillflowFetch("/expense-categories", { token });
}

export function createExpenseCategoryRequest(token, body) {
  return tillflowFetch("/expense-categories", { method: "POST", token, body });
}

export function updateExpenseCategoryRequest(token, id, body) {
  return tillflowFetch(`/expense-categories/${encodeURIComponent(String(id))}`, { method: "PATCH", token, body });
}

export function deleteExpenseCategoryRequest(token, id) {
  return tillflowFetch(`/expense-categories/${encodeURIComponent(String(id))}`, { method: "DELETE", token });
}

export function listExpenseRecurringRulesRequest(token) {
  return tillflowFetch("/expense-recurring-rules", { token });
}

export function createExpenseRecurringRuleRequest(token, body) {
  return tillflowFetch("/expense-recurring-rules", { method: "POST", token, body });
}

export function updateExpenseRecurringRuleRequest(token, id, body) {
  return tillflowFetch(`/expense-recurring-rules/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    token,
    body
  });
}

export function deleteExpenseRecurringRuleRequest(token, id) {
  return tillflowFetch(`/expense-recurring-rules/${encodeURIComponent(String(id))}`, { method: "DELETE", token });
}

export function runExpenseRecurringNowRequest(token) {
  return tillflowFetch("/expense-recurring-rules/run-now", { method: "POST", token });
}


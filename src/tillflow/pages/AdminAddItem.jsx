import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listBrandsRequest } from '../api/brands';
import { listCategoriesRequest } from '../api/categories';
import { listUnitsRequest } from '../api/units';
import { listVariantAttributesRequest } from '../api/variantAttributes';
import { listWarrantiesRequest } from '../api/warranties';
import { listStoresRequest } from '../api/stores';
import { listTaxRatesRequest } from '../api/taxRates';
import { TillFlowApiError } from '../api/errors';
import {
  createProductRequest,
  getProductRequest,
  listProductsRequest,
  updateProductRequest,
  uploadProductMainImageRequest,
  uploadProductVariantImageRequest
} from '../api/products';
import { useAuth } from '../auth/AuthContext';
import { buildTaxRateSelectOptions, DEFAULT_TAX_RATES } from '../settings/taxRatesCatalog';

const discountTypeOpts = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'cash', label: 'Cash' },
];

function slugifyText(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function buildSkuFromSeq(seq) {
  const n = Number.isFinite(seq) && seq > 0 ? seq : 1;
  return `SK-${String(n).padStart(5, '0')}`;
}

function parseSkuSeq(value) {
  const m = /^SK-(\d+)$/i.exec(String(value ?? '').trim());
  if (!m) {
    return null;
  }
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** @param {unknown} raw */
function normalizeAttributeValues(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((v) => (v == null ? '' : String(v).trim())).filter(Boolean);
}

function makeVariantLineKey(attributeId, value) {
  return `${attributeId}\u0001${String(value)}`;
}

function parseVariantQty(s) {
  const n = parseInt(String(s ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseVariantPrice(s) {
  const t = String(s ?? '').trim();
  if (t === '') {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Create/update endpoints may return `{ product }` or the product object at the top of `data`.
 * @param {unknown} data
 * @returns {object | null}
 */
function extractProductFromApiData(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const d = /** @type {Record<string, unknown>} */ (data);
  if (d.product && typeof d.product === 'object') {
    return /** @type {object} */ (d.product);
  }
  if (d.id != null) {
    return /** @type {object} */ (d);
  }
  return null;
}

function SelectField({ label, required, value, onChange, options, disabled = false }) {
  return (
    <div className="mb-3">
      <label className="form-label">
        {label}
        {required ? <span className="text-danger ms-1">*</span> : null}
      </label>
      <select
        className="form-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}>
        <option value="">Choose</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminAddItem() {
  const { productId } = useParams();
  const isEditMode = Boolean(productId);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState('');
  const [itemName, setItemName] = useState('');
  const [slug, setSlug] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');

  const [itemType, setItemType] = useState('single');
  const [quantity, setQuantity] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [taxType, setTaxType] = useState('');
  const [discountType, setDiscountType] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [quantityAlert, setQuantityAlert] = useState('');

  const [warrantyEnabled, setWarrantyEnabled] = useState(false);
  const [manufacturerEnabled, setManufacturerEnabled] = useState(false);
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [warranty, setWarranty] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [manufacturedDate, setManufacturedDate] = useState('');
  const [expiryOn, setExpiryOn] = useState('');

  useEffect(() => {
    if (!warrantyEnabled) {
      setWarranty('');
    }
  }, [warrantyEnabled]);

  const [formError, setFormError] = useState('');
  const [validationPopup, setValidationPopup] = useState('');
  const [fieldErrors, setFieldErrors] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [storeOptions, setStoreOptions] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesLoadError, setStoresLoadError] = useState('');
  const [nextSkuSeq, setNextSkuSeq] = useState(1);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesLoadError, setCategoriesLoadError] = useState('');
  const [brandOptions, setBrandOptions] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsLoadError, setBrandsLoadError] = useState('');
  const [unitOptions, setUnitOptions] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsLoadError, setUnitsLoadError] = useState('');
  const [warrantyOptions, setWarrantyOptions] = useState([]);
  const [taxTypeOptions, setTaxTypeOptions] = useState(() =>
    buildTaxRateSelectOptions(DEFAULT_TAX_RATES)
  );
  const [taxTypesLoading, setTaxTypesLoading] = useState(true);
  const [taxTypesLoadError, setTaxTypesLoadError] = useState('');
  const [warrantiesLoading, setWarrantiesLoading] = useState(true);
  const [warrantiesLoadError, setWarrantiesLoadError] = useState('');

  const [variantAttributes, setVariantAttributes] = useState([]);
  const [variantAttributesLoading, setVariantAttributesLoading] = useState(true);
  const [variantAttributesLoadError, setVariantAttributesLoadError] = useState('');
  /** @type {Record<string, { sku: string; qty: string; buyingPrice: string; sellingPrice: string; imageFile: File | null; imagePreviewUrl: string | null }>} */
  const [variantLineFields, setVariantLineFields] = useState(() => ({}));
  const variantLineFieldsRef = useRef(variantLineFields);
  variantLineFieldsRef.current = variantLineFields;
  const variantAttributesRef = useRef(variantAttributes);
  variantAttributesRef.current = variantAttributes;

  const [variantPickerAttributeId, setVariantPickerAttributeId] = useState('');
  const [variantPickerValue, setVariantPickerValue] = useState('');
  const [variantPickerMessage, setVariantPickerMessage] = useState('');
  /** @type {{ lineKey: string; attributeId: number; attributeName: string; value: string }[]} */
  const [addedVariantRows, setAddedVariantRows] = useState(() => []);
  const [mainImageFile, setMainImageFile] = useState(null);
  const [mainImagePreviewUrl, setMainImagePreviewUrl] = useState(null);
  const mainImageInputRef = useRef(null);

  useEffect(() => {
    const generatedSlug = slugifyText(itemName);
    setSlug(generatedSlug);
  }, [itemName]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }
    setSku(buildSkuFromSeq(nextSkuSeq));
  }, [isEditMode, nextSkuSeq]);

  useEffect(() => {
    let cancelled = false;
    async function loadNextSkuSeq() {
      if (!token || isEditMode) {
        return;
      }
      try {
        const data = await listProductsRequest(token);
        const rows = Array.isArray(data?.products) ? data.products : [];
        let maxSeq = 0;
        for (const p of rows) {
          const seq = parseSkuSeq(p?.sku);
          if (seq != null && seq > maxSeq) {
            maxSeq = seq;
          }
        }
        if (!cancelled) {
          setNextSkuSeq(maxSeq + 1);
        }
      } catch {
        if (!cancelled) {
          setNextSkuSeq(1);
        }
      }
    }
    void loadNextSkuSeq();
    return () => {
      cancelled = true;
    };
  }, [token, isEditMode]);

  useEffect(() => {
    let cancelled = false;
    async function loadStores() {
      if (!token) {
        setStoresLoading(false);
        setStoreOptions([]);
        return;
      }
      setStoresLoading(true);
      setStoresLoadError('');
      try {
        const data = await listStoresRequest(token);
        const list = data.stores ?? [];
        if (!cancelled) {
          setStoreOptions(list);
        }
      } catch (e) {
        if (!cancelled) {
          setStoreOptions([]);
          if (e instanceof TillFlowApiError) {
            setStoresLoadError(e.status === 403 ? `${e.message} (needs catalog permission)` : e.message);
          } else {
            setStoresLoadError('Could not load stores');
          }
        }
      } finally {
        if (!cancelled) {
          setStoresLoading(false);
        }
      }
    }
    void loadStores();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function loadTaxRates() {
      if (!token) {
        setTaxTypesLoading(false);
        setTaxTypeOptions(buildTaxRateSelectOptions(DEFAULT_TAX_RATES));
        return;
      }
      setTaxTypesLoading(true);
      setTaxTypesLoadError('');
      try {
        const rows = await listTaxRatesRequest(token);
        if (!cancelled) {
          setTaxTypeOptions(buildTaxRateSelectOptions(rows));
        }
      } catch (e) {
        if (!cancelled) {
          setTaxTypeOptions(buildTaxRateSelectOptions(DEFAULT_TAX_RATES));
          if (e instanceof TillFlowApiError) {
            setTaxTypesLoadError(e.message);
          } else {
            setTaxTypesLoadError('Could not load tax rates');
          }
        }
      } finally {
        if (!cancelled) {
          setTaxTypesLoading(false);
        }
      }
    }
    void loadTaxRates();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      if (!token) {
        setCategoriesLoading(false);
        setCategoryOptions([]);
        return;
      }
      setCategoriesLoading(true);
      setCategoriesLoadError('');
      try {
        const data = await listCategoriesRequest(token);
        const list = data.categories ?? [];
        if (!cancelled) {
          setCategoryOptions(list);
        }
      } catch (e) {
        if (!cancelled) {
          setCategoryOptions([]);
          if (e instanceof TillFlowApiError) {
            setCategoriesLoadError(e.status === 403 ? `${e.message} (needs catalog permission)` : e.message);
          } else {
            setCategoriesLoadError('Could not load categories');
          }
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    }
    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function loadBrands() {
      if (!token) {
        setBrandsLoading(false);
        setBrandOptions([]);
        return;
      }
      setBrandsLoading(true);
      setBrandsLoadError('');
      try {
        const data = await listBrandsRequest(token);
        const list = data.brands ?? [];
        if (!cancelled) {
          setBrandOptions(list);
        }
      } catch (e) {
        if (!cancelled) {
          setBrandOptions([]);
          if (e instanceof TillFlowApiError) {
            setBrandsLoadError(e.status === 403 ? `${e.message} (needs catalog permission)` : e.message);
          } else {
            setBrandsLoadError('Could not load brands');
          }
        }
      } finally {
        if (!cancelled) {
          setBrandsLoading(false);
        }
      }
    }
    void loadBrands();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function loadUnits() {
      if (!token) {
        setUnitsLoading(false);
        setUnitOptions([]);
        return;
      }
      setUnitsLoading(true);
      setUnitsLoadError('');
      try {
        const data = await listUnitsRequest(token);
        const list = data.units ?? [];
        if (!cancelled) {
          setUnitOptions(list);
        }
      } catch (e) {
        if (!cancelled) {
          setUnitOptions([]);
          if (e instanceof TillFlowApiError) {
            setUnitsLoadError(e.status === 403 ? `${e.message} (needs catalog permission)` : e.message);
          } else {
            setUnitsLoadError('Could not load units');
          }
        }
      } finally {
        if (!cancelled) {
          setUnitsLoading(false);
        }
      }
    }
    void loadUnits();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function loadWarranties() {
      if (!token) {
        setWarrantiesLoading(false);
        setWarrantyOptions([]);
        return;
      }
      setWarrantiesLoading(true);
      setWarrantiesLoadError('');
      try {
        const data = await listWarrantiesRequest(token);
        const list = (data.warranties ?? []).filter((w) => w.is_active);
        if (!cancelled) {
          setWarrantyOptions(list);
        }
      } catch (e) {
        if (!cancelled) {
          setWarrantyOptions([]);
          if (e instanceof TillFlowApiError) {
            setWarrantiesLoadError(e.status === 403 ? `${e.message} (needs catalog permission)` : e.message);
          } else {
            setWarrantiesLoadError('Could not load warranties');
          }
        }
      } finally {
        if (!cancelled) {
          setWarrantiesLoading(false);
        }
      }
    }
    void loadWarranties();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function loadVariantAttributes() {
      if (!token) {
        setVariantAttributesLoading(false);
        setVariantAttributes([]);
        return;
      }
      setVariantAttributesLoading(true);
      setVariantAttributesLoadError('');
      try {
        const data = await listVariantAttributesRequest(token);
        const list = data.attributes ?? [];
        if (!cancelled) {
          setVariantAttributes(list);
        }
      } catch (e) {
        if (!cancelled) {
          setVariantAttributes([]);
          if (e instanceof TillFlowApiError) {
            setVariantAttributesLoadError(e.status === 403 ? `${e.message} (needs catalog permission)` : e.message);
          } else {
            setVariantAttributesLoadError('Could not load variant attributes');
          }
        }
      } finally {
        if (!cancelled) {
          setVariantAttributesLoading(false);
        }
      }
    }
    void loadVariantAttributes();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!isEditMode || !productId || !token) {
      return;
    }
    let cancelled = false;
    (async () => {
      setEditLoading(true);
      setEditLoadError('');
      try {
        const data = await getProductRequest(token, productId);
        const p = data.product;
        if (cancelled || !p) {
          return;
        }
        setItemName(p.name ?? '');
        setStore(p.store_id != null ? String(p.store_id) : '');
        setSku(p.sku ?? '');
        setBarcode(p.sku ?? '');
        setCategory(p.category_id != null ? String(p.category_id) : '');
        setBrand(p.brand_id != null ? String(p.brand_id) : '');
        setUnit(p.unit_id != null ? String(p.unit_id) : '');
        setBuyingPrice(p.buying_price != null ? String(p.buying_price) : '');
        setSellingPrice(p.selling_price != null ? String(p.selling_price) : '');
        setQuantity(p.qty != null ? String(p.qty) : '');
        setQuantityAlert(p.qty_alert != null ? String(p.qty_alert) : '');
        setMainImageFile(null);
        setMainImagePreviewUrl(p.image_url ?? p.image ?? null);
        if (mainImageInputRef.current) {
          mainImageInputRef.current.value = '';
        }
        if (p.warranty_id) {
          setWarrantyEnabled(true);
          setWarranty(String(p.warranty_id));
        } else {
          setWarrantyEnabled(false);
          setWarranty('');
        }
        if (p.manufactured_at) {
          setManufacturerEnabled(true);
          setManufacturedDate(String(p.manufactured_at).slice(0, 10));
        } else {
          setManufacturerEnabled(false);
          setManufacturedDate('');
        }
        if (p.expires_at) {
          setExpiryEnabled(true);
          setExpiryOn(String(p.expires_at).slice(0, 10));
        } else {
          setExpiryEnabled(false);
          setExpiryOn('');
        }
        const vars = p.variants ?? [];
        const attrs = variantAttributesRef.current;
        if (vars.length > 0) {
          setItemType('variable');
          const rows = vars.map((v) => {
            const attr = attrs.find((a) => Number(a.id) === Number(v.variant_attribute_id));
            return {
              lineKey: makeVariantLineKey(v.variant_attribute_id, v.value),
              attributeId: Number(v.variant_attribute_id),
              attributeName: attr?.name ?? `Attribute #${v.variant_attribute_id}`,
              value: v.value,
            };
          });
          setAddedVariantRows(rows);
          const vf = {};
          for (const v of vars) {
            const k = makeVariantLineKey(v.variant_attribute_id, v.value);
            const sell = v.selling_price != null ? String(v.selling_price) : v.price != null ? String(v.price) : '';
            vf[k] = {
              sku: v.sku ?? '',
              qty: String(v.qty ?? 0),
              buyingPrice: v.buying_price != null ? String(v.buying_price) : '',
              sellingPrice: sell,
              imageFile: null,
              imagePreviewUrl: v.image_url || null,
            };
          }
          setVariantLineFields(vf);
        } else {
          setItemType('single');
          setAddedVariantRows([]);
          setVariantLineFields({});
        }
      } catch (e) {
        if (!cancelled) {
          setEditLoadError(e instanceof TillFlowApiError ? e.message : 'Could not load item');
        }
      } finally {
        if (!cancelled) {
          setEditLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, productId, token]);

  const activeVariantAttributes = useMemo(
    () => variantAttributes.filter((a) => a.is_active !== false),
    [variantAttributes]
  );

  const selectedPickerAttribute = useMemo(
    () => activeVariantAttributes.find((a) => String(a.id) === String(variantPickerAttributeId)),
    [activeVariantAttributes, variantPickerAttributeId]
  );

  const pickerValueOptions = useMemo(
    () => normalizeAttributeValues(selectedPickerAttribute?.values ?? []),
    [selectedPickerAttribute]
  );

  useEffect(() => {
    setVariantPickerValue('');
  }, [variantPickerAttributeId]);

  useEffect(() => {
    setVariantLineFields((prev) => {
      const next = { ...prev };
      for (const row of addedVariantRows) {
        if (!next[row.lineKey]) {
          next[row.lineKey] = {
            sku: '',
            qty: '',
            buyingPrice: '',
            sellingPrice: '',
            imageFile: null,
            imagePreviewUrl: null,
          };
        }
      }
      const valid = new Set(addedVariantRows.map((r) => r.lineKey));
      for (const k of Object.keys(next)) {
        if (!valid.has(k)) {
          const prevUrl = next[k]?.imagePreviewUrl;
          if (prevUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(prevUrl);
          }
          delete next[k];
        }
      }
      return next;
    });
  }, [addedVariantRows]);

  function addSelectedVariantToList() {
    setVariantPickerMessage('');
    if (!variantPickerAttributeId || variantPickerValue === '') {
      setVariantPickerMessage('Choose a variant attribute and a value.');
      return;
    }
    const attr = activeVariantAttributes.find((a) => String(a.id) === String(variantPickerAttributeId));
    if (!attr) {
      setVariantPickerMessage('Invalid variant attribute.');
      return;
    }
    const value = String(variantPickerValue).trim();
    const lineKey = makeVariantLineKey(attr.id, value);
    if (addedVariantRows.some((r) => r.lineKey === lineKey)) {
      setVariantPickerMessage('That combination is already in the list.');
      return;
    }
    setAddedVariantRows((prev) => [
      ...prev,
      { lineKey, attributeId: Number(attr.id), attributeName: attr.name ?? '—', value },
    ]);
  }

  function removeVariantRow(lineKey) {
    setVariantLineFields((prev) => {
      const row = prev[lineKey];
      if (row?.imagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(row.imagePreviewUrl);
      }
      const next = { ...prev };
      delete next[lineKey];
      return next;
    });
    setAddedVariantRows((prev) => prev.filter((r) => r.lineKey !== lineKey));
  }

  useEffect(() => {
    return () => {
      if (mainImagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(mainImagePreviewUrl);
      }
      for (const v of Object.values(variantLineFieldsRef.current)) {
        if (v?.imagePreviewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(v.imagePreviewUrl);
        }
      }
    };
  }, [mainImagePreviewUrl]);

  function handleGenerateBarcode() {
    setBarcode(`BAR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setValidationPopup('');
    setFieldErrors(null);
    if (!String(itemName).trim()) {
      const msg = 'Item name is required.';
      setFormError(msg);
      setValidationPopup(msg);
      return;
    }
    if (!store) {
      const msg = "Store is required. Please select a store.";
      setFormError(msg);
      setValidationPopup(msg);
      return;
    }
    if (itemType === 'variable' && addedVariantRows.length === 0) {
      setFormError('Variable item needs at least one variant row. Add combinations with the variant attribute and value dropdowns.');
      return;
    }
    if (itemType === 'single') {
      const buyCheck = parseVariantPrice(buyingPrice);
      const sellCheck = parseVariantPrice(sellingPrice);
      if (buyCheck != null && sellCheck != null && sellCheck <= buyCheck) {
        const msg = 'Selling price should be higher than buying price.';
        setFormError(msg);
        setValidationPopup(msg);
        return;
      }
    }
    if (itemType === 'variable') {
      for (const row of addedVariantRows) {
        const f = variantLineFields[row.lineKey];
        const rowBuy = parseVariantPrice(f?.buyingPrice ?? '');
        const rowSell = parseVariantPrice(f?.sellingPrice ?? '');
        if (rowBuy != null && rowSell != null && rowSell <= rowBuy) {
          const msg = `Selling price should be higher than buying price for ${row.attributeName} ${row.value}.`;
          setFormError(msg);
          setValidationPopup(msg);
          return;
        }
      }
    }
    setSaving(true);
    const apiSku = barcode.trim() || sku.trim() || null;
    try {
      const nameTrimmed = String(itemName).trim();
      const slugForApi = String(slug ?? '').trim() || slugifyText(nameTrimmed);
      const body = {
        name: nameTrimmed,
        sku: apiSku,
        store_id: store ? Number(store) : null,
        category_id: category ? Number(category) : null,
        brand_id: brand ? Number(brand) : null,
        unit_id: unit ? Number(unit) : null,
        warranty_id: warrantyEnabled && warranty ? Number(warranty) : null,
      };
      if (slugForApi) {
        body.slug = slugForApi;
      }
      const bp = parseVariantPrice(buyingPrice);
      const sp = parseVariantPrice(sellingPrice);
      if (bp != null) {
        body.buying_price = bp;
      }
      if (sp != null) {
        body.selling_price = sp;
      }
      if (manufacturerEnabled && manufacturedDate.trim()) {
        body.manufactured_at = manufacturedDate.trim();
      }
      if (expiryEnabled && expiryOn.trim()) {
        body.expires_at = expiryOn.trim();
      }
      if (itemType === 'single') {
        if (quantity.trim() !== '') {
          body.qty = parseVariantQty(quantity);
        }
        if (quantityAlert.trim() !== '') {
          const qa = parseInt(quantityAlert, 10);
          if (Number.isFinite(qa) && qa >= 0) {
            body.qty_alert = qa;
          }
        }
      }
      if (itemType === 'variable') {
        body.variants = addedVariantRows.map((row) => {
          const f = variantLineFields[row.lineKey] ?? {
            sku: '',
            qty: '',
            buyingPrice: '',
            sellingPrice: '',
            imageFile: null,
            imagePreviewUrl: null,
          };
          const skuPart = String(f.sku ?? '').trim();
          const sellNum = parseVariantPrice(f.sellingPrice);
          const buyNum = parseVariantPrice(f.buyingPrice);
          return {
            variant_attribute_id: row.attributeId,
            value: row.value,
            sku: skuPart === '' ? null : skuPart,
            qty: parseVariantQty(f.qty),
            buying_price: buyNum,
            selling_price: sellNum,
          };
        });
      } else if (isEditMode) {
        body.variants = [];
      }

      let savedProduct;
      if (isEditMode) {
        const data = await updateProductRequest(token, productId, body);
        savedProduct = extractProductFromApiData(data);
      } else {
        const data = await createProductRequest(token, body);
        savedProduct = extractProductFromApiData(data);
      }

      if (!savedProduct?.id) {
        setFormError(
          'Could not confirm the item was saved — the API response did not include a product id. Check the network tab for POST /products, or Laravel logs.'
        );
        return;
      }

      if (itemType === 'variable' && savedProduct?.variants?.length) {
        for (const row of addedVariantRows) {
          const f = variantLineFields[row.lineKey];
          if (!f?.imageFile) {
            continue;
          }
          const match = savedProduct.variants.find(
            (v) => Number(v.variant_attribute_id) === Number(row.attributeId) && String(v.value) === String(row.value)
          );
          if (match) {
            await uploadProductVariantImageRequest(token, savedProduct.id, match.id, f.imageFile);
          }
        }
      }
      if (savedProduct?.id && mainImageFile) {
        try {
          await uploadProductMainImageRequest(token, savedProduct.id, mainImageFile);
        } catch {
          // Keep item save successful even when image endpoint is unavailable.
        }
      }
      navigate('/admin/items', { replace: false });
    } catch (err) {
      if (err instanceof TillFlowApiError) {
        setFormError(err.message);
        if (err.data && typeof err.data === 'object' && err.data.errors) {
          setFieldErrors(err.data.errors);
        }
      } else {
        setFormError(isEditMode ? 'Could not update item' : 'Could not create item');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tf-add-item">
      {validationPopup ? (
        <div
          className="alert alert-danger shadow-sm"
          role="alert"
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 1055,
            maxWidth: 420,
            marginBottom: 0,
          }}
        >
          <div className="d-flex align-items-start justify-content-between gap-3">
            <span>{validationPopup}</span>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => setValidationPopup('')}
            />
          </div>
        </div>
      ) : null}
      <div className="content-inner">
        <div className="page-header d-flex flex-wrap justify-content-between gap-3">
          <div className="add-item d-flex">
            <div className="page-title">
              <h4>{isEditMode ? 'Edit item' : 'Create item'}</h4>
              <h6>{isEditMode ? 'Update catalog fields and variants' : 'Create new item'}</h6>
            </div>
          </div>
          <ul className="table-top-head">
            <li>
              <div className="page-btn">
                <Link to="/admin/items" className="btn btn-secondary">
                  <i className="feather icon-arrow-left me-2" />
                  Back to Items
                </Link>
              </div>
            </li>
          </ul>
        </div>

        <form className="add-product-form" onSubmit={handleSubmit}>
          {editLoadError ? (
            <div className="alert alert-danger mb-3" role="alert">
              {editLoadError}
            </div>
          ) : null}
          {editLoading ? (
            <div className="alert alert-secondary mb-3" role="status">
              Loading item…
            </div>
          ) : null}
          {formError ? (
            <div className="alert alert-danger mb-3" role="alert">
              {formError}
            </div>
          ) : null}

          <div className="add-product">
            <div className="accordions-items-seperate" id="accordionSpacingExample">
              {/* Item Information */}
              <div className="accordion-item border mb-4">
                <h2 className="accordion-header" id="headingSpacingOne">
                  <button
                    type="button"
                    className="accordion-button"
                    data-bs-toggle="collapse"
                    data-bs-target="#SpacingOne"
                    aria-expanded="true"
                    aria-controls="SpacingOne"
                  >
                    <h5 className="d-flex align-items-center mb-0">
                      <i className="feather icon-info text-primary me-2" />
                      <span>Item Information</span>
                    </h5>
                  </button>
                </h2>
                <div id="SpacingOne" className="accordion-collapse collapse show" aria-labelledby="headingSpacingOne">
                  <div className="accordion-body border-top">
                    <div className="row">
                      <div className="col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Item Name
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            required
                            maxLength={255}
                          />
                          {fieldErrors?.name ? (
                            <div className="text-danger small mt-1">{fieldErrors.name[0]}</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Slug
                          </label>
                          <input type="text" className="form-control" value={slug} readOnly />
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-sm-6 col-12">
                        <div className="mb-3 list position-relative">
                          <label className="form-label">
                            SKU
                          </label>
                          <input type="text" className="form-control list" value={sku} readOnly />
                        </div>
                      </div>
                      <div className="col-sm-6 col-12">
                        <div className="mb-3 list position-relative">
                          <label className="form-label">
                            Barcode
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control list"
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            placeholder="Barcode format is standardized system-wide (Code128)."
                          />
                          <button type="button" className="btn btn-primaryadd" onClick={handleGenerateBarcode}>
                            Generate
                          </button>
                          {fieldErrors?.sku ? <div className="text-danger small mt-1">{fieldErrors.sku[0]}</div> : null}
                        </div>
                      </div>
                    </div>
                    <div className="addservice-info">
                      <div className="row">
                        <div className="col-sm-6 col-12">
                          <div className="mb-3">
                            <div className="add-newplus">
                              <label className="form-label mb-0">Category</label>
                              <Link to="/admin/categories">
                                <i className="feather icon-plus-circle plus-down-add" />
                                <span>Add New</span>
                              </Link>
                            </div>
                            {categoriesLoadError ? (
                              <div className="text-danger small mt-2">{categoriesLoadError}</div>
                            ) : null}
                            <select
                              className="form-select mt-2"
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                              aria-label="Category"
                              disabled={categoriesLoading}
                            >
                              <option value="">{categoriesLoading ? 'Loading…' : 'Choose (optional)'}</option>
                              {categoryOptions.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            {fieldErrors?.category_id ? (
                              <div className="text-danger small mt-1">{fieldErrors.category_id[0]}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="col-sm-6 col-12">
                          <div className="mb-3">
                            <label className="form-label">
                              Store
                              <span className="text-danger ms-1">*</span>
                            </label>
                            {storesLoadError ? <div className="text-danger small mb-2">{storesLoadError}</div> : null}
                            <select
                              className="form-select mt-2"
                              value={store}
                              onChange={(e) => setStore(e.target.value)}
                              disabled={storesLoading}
                              required
                            >
                              <option value="">{storesLoading ? 'Loading…' : 'Choose'}</option>
                              {storeOptions.map((s) => (
                                <option key={String(s.id)} value={String(s.id)}>
                                  {String(s.name ?? 'Unnamed store')}
                                </option>
                              ))}
                            </select>
                            {fieldErrors?.store_id ? (
                              <div className="text-danger small mt-1">{fieldErrors.store_id[0]}</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="add-product-new">
                      <div className="row">
                        <div className="col-sm-6 col-12">
                          <div className="mb-3">
                            <div className="add-newplus">
                              <label className="form-label mb-0">Brand</label>
                              <Link to="/admin/brands">
                                <i className="feather icon-plus-circle plus-down-add" />
                                <span>Manage</span>
                              </Link>
                            </div>
                            {brandsLoadError ? (
                              <div className="text-danger small mt-2">{brandsLoadError}</div>
                            ) : null}
                            <select
                              className="form-select mt-2"
                              value={brand}
                              onChange={(e) => setBrand(e.target.value)}
                              aria-label="Brand"
                              disabled={brandsLoading}
                            >
                              <option value="">{brandsLoading ? 'Loading…' : 'Choose (optional)'}</option>
                              {brandOptions.map((b) => (
                                <option key={b.id} value={String(b.id)}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                            {fieldErrors?.brand_id ? (
                              <div className="text-danger small mt-1">{fieldErrors.brand_id[0]}</div>
                            ) : null}
                          </div>
                        </div>
                        <div className="col-sm-6 col-12">
                          <div className="mb-3">
                            <div className="add-newplus">
                              <label className="form-label mb-0">
                                Unit
                                <span className="text-danger ms-1">*</span>
                              </label>
                              <Link to="/admin/units">
                                <i className="feather icon-plus-circle plus-down-add" />
                                <span>Manage</span>
                              </Link>
                            </div>
                            {unitsLoadError ? <div className="text-danger small mt-2">{unitsLoadError}</div> : null}
                            <select
                              className="form-select mt-2"
                              value={unit}
                              onChange={(e) => setUnit(e.target.value)}
                              aria-label="Unit"
                              disabled={unitsLoading}
                              required
                            >
                              <option value="">{unitsLoading ? 'Loading…' : 'Choose'}</option>
                              {unitOptions.map((u) => (
                                <option key={u.id} value={String(u.id)}>
                                  {u.name} ({u.short_name})
                                </option>
                              ))}
                            </select>
                            {fieldErrors?.unit_id ? <div className="text-danger small mt-1">{fieldErrors.unit_id[0]}</div> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-12 px-0">
                      <div className="mb-3">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          rows={5}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Maximum 60 Words"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing & Stocks */}
              <div className="accordion-item border mb-4">
                <h2 className="accordion-header" id="headingSpacingTwo">
                  <button
                    type="button"
                    className="accordion-button"
                    data-bs-toggle="collapse"
                    data-bs-target="#SpacingTwo"
                    aria-expanded="true"
                    aria-controls="SpacingTwo"
                  >
                    <h5 className="d-flex align-items-center mb-0">
                      <i className="feather icon-life-buoy text-primary me-2" />
                      <span>Pricing &amp; Stocks</span>
                    </h5>
                  </button>
                </h2>
                <div id="SpacingTwo" className="accordion-collapse collapse show" aria-labelledby="headingSpacingTwo">
                  <div className="accordion-body border-top">
                    <div className="mb-3s">
                      <label className="form-label">
                        Item Type
                        <span className="text-danger ms-1">*</span>
                      </label>
                      <div className="single-pill-product mb-3 d-flex flex-wrap gap-3">
                        <label
                          className={`custom_radio mb-0${itemType === 'single' ? ' active' : ''}`}>
                          <input
                            type="radio"
                            name="itemType"
                            checked={itemType === 'single'}
                            onChange={() => setItemType('single')}
                          />
                          <span className="checkmark" /> Single Item
                        </label>
                        <label
                          className={`custom_radio mb-0${itemType === 'variable' ? ' active' : ''}`}>
                          <input
                            type="radio"
                            name="itemType"
                            checked={itemType === 'variable'}
                            onChange={() => setItemType('variable')}
                          />
                          <span className="checkmark" /> Variable Item
                        </label>
                      </div>
                    </div>

                    {itemType === 'single' ? (
                      <div className="single-product">
                        <div className="row">
                          <div className="col-lg-4 col-sm-6 col-12">
                            <div className="mb-3">
                              <label className="form-label">
                                Quantity
                                <span className="text-danger ms-1">*</span>
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                className="form-control"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-4 col-sm-6 col-12">
                            <div className="mb-3">
                              <label className="form-label">Buying price</label>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                inputMode="decimal"
                                className="form-control"
                                value={buyingPrice}
                                onChange={(e) => setBuyingPrice(e.target.value)}
                                placeholder="Cost"
                              />
                            </div>
                          </div>
                          <div className="col-lg-4 col-sm-6 col-12">
                            <div className="mb-3">
                              <label className="form-label">Selling price</label>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                inputMode="decimal"
                                className="form-control"
                                value={sellingPrice}
                                onChange={(e) => setSellingPrice(e.target.value)}
                                placeholder="Retail"
                              />
                            </div>
                          </div>
                          <div className="col-lg-4 col-sm-6 col-12">
                            {taxTypesLoadError ? (
                              <div className="text-warning small mb-1">{taxTypesLoadError}</div>
                            ) : null}
                            <SelectField
                              label="Tax Type"
                              options={taxTypeOptions}
                              value={taxType}
                              onChange={setTaxType}
                              disabled={taxTypesLoading}
                            />
                          </div>
                          <div className="col-lg-4 col-sm-6 col-12">
                            <SelectField
                              label="Discount Type"
                              options={discountTypeOpts}
                              value={discountType}
                              onChange={setDiscountType}
                            />
                          </div>
                          <div className="col-lg-4 col-sm-6 col-12">
                            <div className="mb-3">
                              <label className="form-label">
                                Discount Value
                              </label>
                              <input
                                className="form-control"
                                type="text"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-4 col-sm-6 col-12">
                            <div className="mb-3">
                              <label className="form-label">
                                Quantity Alert
                                <span className="text-danger ms-1">*</span>
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                className="form-control"
                                value={quantityAlert}
                                onChange={(e) => setQuantityAlert(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="variable-product">
                        {variantAttributesLoadError ? (
                          <div className="alert alert-warning small mb-3" role="alert">
                            {variantAttributesLoadError}
                          </div>
                        ) : null}
                        {variantAttributesLoading ? (
                          <p className="text-muted small mb-0">Loading variant attributes…</p>
                        ) : activeVariantAttributes.length === 0 ? (
                          <div
                            className="rounded p-3 border"
                            style={{ borderColor: 'var(--tf-border)', background: 'var(--tf-surface-2)' }}
                          >
                            <p className="small text-muted mb-2">
                              No active variant attributes yet. Define attributes (e.g. Color, Size) and their allowed values under Variant attributes.
                            </p>
                            <Link to="/admin/variant-attributes" className="btn btn-sm btn-outline-primary">
                              Manage variant attributes
                            </Link>
                          </div>
                        ) : (
                          <>
                            <p className="small text-muted mb-3">
                              Choose a variant attribute and value, then <strong>Add variant</strong> (DreamsPOS-style). Only rows you add are saved. Optional
                              image per row uploads after the parent item is created.
                            </p>
                            <div className="row g-2 align-items-end mb-3">
                              <div className="col-md-4 col-lg-4">
                                <label className="form-label small mb-1">Variant attribute</label>
                                <select
                                  className="form-select form-select-sm"
                                  value={variantPickerAttributeId}
                                  onChange={(e) => setVariantPickerAttributeId(e.target.value)}
                                  aria-label="Variant attribute"
                                >
                                  <option value="">Choose</option>
                                  {activeVariantAttributes.map((a) => (
                                    <option key={a.id} value={String(a.id)}>
                                      {a.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-md-4 col-lg-4">
                                <label className="form-label small mb-1">Variant value</label>
                                <select
                                  className="form-select form-select-sm"
                                  value={variantPickerValue}
                                  onChange={(e) => setVariantPickerValue(e.target.value)}
                                  disabled={!variantPickerAttributeId || pickerValueOptions.length === 0}
                                  aria-label="Variant value"
                                >
                                  <option value="">{variantPickerAttributeId ? 'Choose value' : '—'}</option>
                                  {pickerValueOptions.map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-md-4 col-lg-4 d-flex flex-wrap gap-2 align-items-center">
                                <button type="button" className="btn btn-sm btn-primary" onClick={addSelectedVariantToList}>
                                  <i className="feather icon-plus me-1" aria-hidden />
                                  Add variant
                                </button>
                                <Link
                                  to="/admin/variant-attributes"
                                  className="btn btn-sm btn-outline-secondary"
                                  title="Manage variant attributes"
                                >
                                  <i className="feather icon-settings" aria-hidden />
                                </Link>
                              </div>
                            </div>
                            {variantPickerMessage ? (
                              <p className="small text-warning mb-2" role="status">
                                {variantPickerMessage}
                              </p>
                            ) : null}
                            {addedVariantRows.length === 0 ? (
                              <p className="small text-muted mb-2">No variants in the list yet — use the dropdowns above.</p>
                            ) : null}
                            {addedVariantRows.length > 0 ? (
                            <div className="table-responsive">
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th>Image</th>
                                    <th>Variation</th>
                                    <th>Variant value</th>
                                    <th>SKU</th>
                                    <th>Quantity</th>
                                    <th>Buying</th>
                                    <th>Selling</th>
                                    <th className="no-sort" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {addedVariantRows.map((row) => {
                                    const fields = variantLineFields[row.lineKey] ?? {
                                      sku: '',
                                      qty: '',
                                      buyingPrice: '',
                                      sellingPrice: '',
                                      imageFile: null,
                                      imagePreviewUrl: null,
                                    };
                                    const emptyLine = {
                                      sku: '',
                                      qty: '',
                                      buyingPrice: '',
                                      sellingPrice: '',
                                      imageFile: null,
                                      imagePreviewUrl: null,
                                    };
                                    return (
                                      <tr key={row.lineKey}>
                                        <td style={{ width: 120, verticalAlign: 'middle' }}>
                                          <div className="d-flex flex-column align-items-start gap-1">
                                            {fields.imagePreviewUrl ? (
                                              <img
                                                src={fields.imagePreviewUrl}
                                                alt=""
                                                className="rounded border"
                                                style={{ width: 56, height: 56, objectFit: 'cover' }}
                                              />
                                            ) : (
                                              <div
                                                className="rounded border d-flex align-items-center justify-content-center text-muted small"
                                                style={{ width: 56, height: 56, fontSize: '0.65rem' }}
                                              >
                                                No image
                                              </div>
                                            )}
                                            <label className="btn btn-sm btn-outline-secondary mb-0">
                                              Browse
                                              <input
                                                type="file"
                                                className="d-none"
                                                accept="image/*"
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0] ?? null;
                                                  e.target.value = '';
                                                  setVariantLineFields((prev) => {
                                                    const cur = prev[row.lineKey] ?? { ...emptyLine };
                                                    if (cur.imagePreviewUrl?.startsWith('blob:')) {
                                                      URL.revokeObjectURL(cur.imagePreviewUrl);
                                                    }
                                                    return {
                                                      ...prev,
                                                      [row.lineKey]: {
                                                        ...cur,
                                                        imageFile: file,
                                                        imagePreviewUrl: file ? URL.createObjectURL(file) : null,
                                                      },
                                                    };
                                                  });
                                                }}
                                              />
                                            </label>
                                          </div>
                                        </td>
                                        <td>
                                          <span className="fw-medium">{row.attributeName}</span>
                                        </td>
                                        <td>
                                          <span>{row.value}</span>
                                        </td>
                                        <td>
                                          <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            value={fields.sku}
                                            onChange={(e) =>
                                              setVariantLineFields((prev) => {
                                                const cur = prev[row.lineKey] ?? { ...emptyLine };
                                                return { ...prev, [row.lineKey]: { ...cur, sku: e.target.value } };
                                              })
                                            }
                                            autoComplete="off"
                                            aria-label={`SKU for ${row.attributeName} ${row.value}`}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            inputMode="numeric"
                                            className="form-control form-control-sm"
                                            value={fields.qty}
                                            onChange={(e) =>
                                              setVariantLineFields((prev) => {
                                                const cur = prev[row.lineKey] ?? { ...emptyLine };
                                                return { ...prev, [row.lineKey]: { ...cur, qty: e.target.value } };
                                              })
                                            }
                                            aria-label={`Quantity for ${row.attributeName} ${row.value}`}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="number"
                                            min={0}
                                            step="any"
                                            inputMode="decimal"
                                            className="form-control form-control-sm"
                                            value={fields.buyingPrice}
                                            onChange={(e) =>
                                              setVariantLineFields((prev) => {
                                                const cur = prev[row.lineKey] ?? { ...emptyLine };
                                                return { ...prev, [row.lineKey]: { ...cur, buyingPrice: e.target.value } };
                                              })
                                            }
                                            aria-label={`Buying price for ${row.attributeName} ${row.value}`}
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="number"
                                            min={0}
                                            step="any"
                                            inputMode="decimal"
                                            className="form-control form-control-sm"
                                            value={fields.sellingPrice}
                                            onChange={(e) =>
                                              setVariantLineFields((prev) => {
                                                const cur = prev[row.lineKey] ?? { ...emptyLine };
                                                return { ...prev, [row.lineKey]: { ...cur, sellingPrice: e.target.value } };
                                              })
                                            }
                                            aria-label={`Selling price for ${row.attributeName} ${row.value}`}
                                          />
                                        </td>
                                        <td>
                                          <button
                                            type="button"
                                            className="btn btn-link text-danger p-0"
                                            onClick={() => removeVariantRow(row.lineKey)}
                                            title="Remove variant row"
                                            aria-label={`Remove ${row.attributeName} ${row.value}`}
                                          >
                                            <i className="feather icon-trash-2" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Images */}
              <div className="accordion-item border mb-4">
                <h2 className="accordion-header" id="headingSpacingThree">
                  <button
                    type="button"
                    className="accordion-button"
                    data-bs-toggle="collapse"
                    data-bs-target="#SpacingThree"
                    aria-expanded="true"
                    aria-controls="SpacingThree"
                  >
                    <h5 className="d-flex align-items-center mb-0">
                      <i className="feather icon-image text-primary me-2" />
                      <span>Images</span>
                    </h5>
                  </button>
                </h2>
                <div id="SpacingThree" className="accordion-collapse collapse show" aria-labelledby="headingSpacingThree">
                  <div className="accordion-body border-top">
                    <div className="mb-3 tf-main-image-upload-row">
                      <div className="image-upload">
                        <input
                          ref={mainImageInputRef}
                          type="file"
                          className="d-none"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setMainImageFile(file);
                            if (mainImagePreviewUrl?.startsWith('blob:')) {
                              URL.revokeObjectURL(mainImagePreviewUrl);
                            }
                            setMainImagePreviewUrl(file ? URL.createObjectURL(file) : null);
                          }}
                        />
                        <button
                          type="button"
                          className="image-uploads w-100 bg-transparent border-0 text-start"
                          onClick={() => mainImageInputRef.current?.click()}>
                          <i className="feather icon-plus-circle plus-down-add me-0" />
                          <div className="tf-main-image-upload-copy">
                            <h4 className="h6 mb-0">Add Main Product Image</h4>
                          </div>
                        </button>
                      </div>
                      {mainImagePreviewUrl ? (
                        <div className="tf-main-image-preview-wrap">
                          <img
                            src={mainImagePreviewUrl}
                            alt="Main product preview"
                            className="rounded border"
                            style={{ maxWidth: 180, maxHeight: 180, objectFit: 'cover' }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              <div className="accordion-item border mb-4">
                <h2 className="accordion-header" id="headingSpacingFour">
                  <button
                    type="button"
                    className="accordion-button"
                    data-bs-toggle="collapse"
                    data-bs-target="#SpacingFour"
                    aria-expanded="true"
                    aria-controls="SpacingFour"
                  >
                    <h5 className="d-flex align-items-center mb-0">
                      <i className="feather icon-list text-primary me-2" />
                      <span>Custom Fields</span>
                    </h5>
                  </button>
                </h2>
                <div id="SpacingFour" className="accordion-collapse collapse show" aria-labelledby="headingSpacingFour">
                  <div className="accordion-body border-top">
                    <div className="p-3 bg-light rounded d-flex flex-wrap align-items-center border mb-3 gap-3">
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="warranties"
                          checked={warrantyEnabled}
                          onChange={(e) => setWarrantyEnabled(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="warranties">
                          Warranties
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="manufacturer"
                          checked={manufacturerEnabled}
                          onChange={(e) => setManufacturerEnabled(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="manufacturer">
                          Manufacturer
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="expiry"
                          checked={expiryEnabled}
                          onChange={(e) => setExpiryEnabled(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="expiry">
                          Expiry
                        </label>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-sm-6 col-12">
                        <div className="mb-3">
                          <div className="add-newplus">
                            <label className="form-label mb-0">
                              Warranty<span className="text-danger ms-1">*</span>
                            </label>
                            <Link to="/admin/warranties">
                              <i className="feather icon-plus-circle plus-down-add" />
                              <span>Manage</span>
                            </Link>
                          </div>
                          {warrantiesLoadError ? <div className="text-danger small mt-2">{warrantiesLoadError}</div> : null}
                          <select
                            className="form-select mt-2"
                            value={warranty}
                            onChange={(e) => setWarranty(e.target.value)}
                            aria-label="Warranty"
                            disabled={!warrantyEnabled || warrantiesLoading}
                            required={warrantyEnabled}
                          >
                            <option value="">
                              {!warrantyEnabled ? 'Disabled' : warrantiesLoading ? 'Loading…' : 'Choose'}
                            </option>
                            {warrantyOptions.map((w) => (
                              <option key={w.id} value={String(w.id)}>
                                {w.name} ({w.duration_value} {w.duration_unit}
                                {w.duration_value === 1 ? '' : 's'})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Manufacturer
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={manufacturer}
                            onChange={(e) => setManufacturer(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Manufactured Date
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <input
                            type="date"
                            className="form-control"
                            value={manufacturedDate}
                            onChange={(e) => setManufacturedDate(e.target.value)}
                            disabled={!manufacturerEnabled}
                          />
                        </div>
                      </div>
                      <div className="col-sm-6 col-12">
                        <div className="mb-3">
                          <label className="form-label">
                            Expiry On
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <input
                            type="date"
                            className="form-control"
                            value={expiryOn}
                            onChange={(e) => setExpiryOn(e.target.value)}
                            disabled={!expiryEnabled}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-12 px-0">
            <div className="d-flex align-items-center justify-content-end mb-4 gap-2">
              <Link to="/admin/items" className="btn btn-secondary">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={saving || !token || editLoading}>
                {saving ? 'Saving…' : isEditMode ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

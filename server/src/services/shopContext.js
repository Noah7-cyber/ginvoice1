const Business = require('../models/Business');
const Shop = require('../models/Shop');

const ensureDefaultShopForBusiness = async (businessId) => {
  const normalizedBusinessId = String(businessId);
  const business = await Business.findById(normalizedBusinessId).select('name defaultShopId').lean();
  if (!business) return null;

  if (business.defaultShopId) {
    return business.defaultShopId;
  }

  let mainShop = await Shop.findOne({ businessId: normalizedBusinessId, isMain: true }).select('_id').lean();
  if (!mainShop) {
    const fallbackName = business.name ? `${business.name} Main Shop` : 'Main Shop';
    mainShop = await Shop.create({
      businessId: normalizedBusinessId,
      name: fallbackName,
      normalizedName: fallbackName.toLowerCase(),
      isMain: true,
      status: 'active'
    });
  }

  const defaultShopId = String(mainShop._id);
  await Business.updateOne({ _id: normalizedBusinessId }, { $set: { defaultShopId } });
  return defaultShopId;
};

const resolveShopId = async ({ businessId, requestedShopId }) => {
  const normalizedBusinessId = String(businessId);
  const defaultShopId = await ensureDefaultShopForBusiness(normalizedBusinessId);
  if (!defaultShopId) return null;

  if (!requestedShopId) return defaultShopId;

  const requested = await Shop.findOne({
    _id: String(requestedShopId),
    businessId: normalizedBusinessId,
    status: 'active'
  }).select('_id').lean();

  return requested ? String(requested._id) : defaultShopId;
};

const isAllShopsMode = (value) => value === true || value === 'true' || value === '1';

const ensureWritableShopContext = async ({ businessId, requestedShopId, allShops }) => {
  if (isAllShopsMode(allShops)) {
    const err = new Error('All Shops mode is read-only. Select a specific shop to continue.');
    err.status = 400;
    throw err;
  }

  const shopId = await resolveShopId({ businessId, requestedShopId });
  if (!shopId) {
    const err = new Error('Could not resolve active shop for this business.');
    err.status = 400;
    throw err;
  }

  return shopId;
};

module.exports = {
  ensureDefaultShopForBusiness,
  resolveShopId,
  isAllShopsMode,
  ensureWritableShopContext
};

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
    mainShop = await Shop.create({
      businessId: normalizedBusinessId,
      name: business.name ? `${business.name} Main Shop` : 'Main Shop',
      isMain: true,
      status: 'active'
    });
  }

  const defaultShopId = String(mainShop._id);
  await Business.updateOne({ _id: normalizedBusinessId }, { $set: { defaultShopId } });
  return defaultShopId;
};

const resolveShopId = async ({ businessId, requestedShopId }) => {
  if (requestedShopId) return String(requestedShopId);
  return ensureDefaultShopForBusiness(businessId);
};

module.exports = {
  ensureDefaultShopForBusiness,
  resolveShopId
};

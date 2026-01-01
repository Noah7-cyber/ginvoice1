const mongoose = require('mongoose');

/**
 * A Mongoose plugin that converts Decimal128 fields to Numbers when toJSON is called.
 * This ensures frontend compatibility for arithmetic operations.
 *
 * @param {mongoose.Schema} schema
 */
function decimal128ToNumberPlugin(schema) {
  // Save original transform if it exists
  const originalTransform = schema.options.toJSON && schema.options.toJSON.transform;

  schema.set('toJSON', {
    virtuals: true,
    getters: true,
    transform: function (doc, ret, options) {
      // Apply original transform first if it exists
      if (typeof originalTransform === 'function') {
        ret = originalTransform(doc, ret, options);
      }

      // Helper function to recursively convert Decimal128 to Number
      const convertDecimal128 = (obj) => {
        if (obj === null || typeof obj !== 'object') return;

        Object.keys(obj).forEach(key => {
          const val = obj[key];

          if (val && (val instanceof mongoose.Types.Decimal128 || (val._bsontype === 'Decimal128') || val.toString().includes('Decimal128'))) {
            obj[key] = parseFloat(val.toString());
          } else if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
                val.forEach(item => convertDecimal128(item));
            } else if (val.constructor && val.constructor.name === 'Object') {
                // Only traverse plain objects to avoid recursion loops or internal Mongoose structures
                convertDecimal128(val);
            }
          }
        });
      };

      convertDecimal128(ret);
      return ret;
    }
  });
}

module.exports = decimal128ToNumberPlugin;

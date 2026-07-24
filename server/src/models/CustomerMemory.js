const mongoose = require('mongoose');

const ConditionalMemorySchema = new mongoose.Schema({
  topic: { type: String, required: true },
  summary: { type: String, required: true },
  occurrences: { type: Number, default: 1 },
  lastMentionedAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30-day TTL (pruned in-app, not by MongoDB index)
  }
}, { _id: true });

const ConfirmedMemorySchema = new mongoose.Schema({
  topic: { type: String, required: true },
  summary: { type: String, required: true },
  importanceScore: { type: Number, default: 5, min: 1, max: 10 },
  lastRecalledAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const CustomerMemorySchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    unique: true,
    index: true
  },

  // Stage 1: Temporary cache — promoted when occurrences >= 3
  conditionalMemories: [ConditionalMemorySchema],

  // Stage 2: Permanent memory — strict 100-slot cap
  confirmedMemories: [ConfirmedMemorySchema],

  confirmedSlotCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Safety: ensure confirmedSlotCount stays in sync
CustomerMemorySchema.pre('save', function (next) {
  this.confirmedSlotCount = this.confirmedMemories.length;
  next();
});

module.exports = mongoose.model('CustomerMemory', CustomerMemorySchema);

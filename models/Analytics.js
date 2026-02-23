const mongoose = require('mongoose');

// Single analytics model: totals + daily rollups in one document per (scope, refId, metric)
const analyticsSchema = new mongoose.Schema({
  scope: { type: String, enum: ['PROGRAM','COURSE','INSTITUTION'], required: true, index: true },
  refId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  metric: { type: String, enum: ['views','comparisons','leads'], required: true, index: true },
  total: { type: Number, default: 0 },
  rollups: {
    type: [{
      day: { type: String, required: true }, // YYYY-MM-DD
      count: { type: Number, default: 0 }
    }],
    default: []
  }
}, { timestamps: true });

analyticsSchema.index({ scope:1, refId:1, metric:1 }, { unique: true });
analyticsSchema.index({ 'rollups.day': 1 });

const AnalyticsMetric = mongoose.model('AnalyticsMetric', analyticsSchema);

module.exports = { AnalyticsMetric };



const mongoose = require('mongoose');

const analyticsDailySchema = new mongoose.Schema({
  scope: { 
    type: String, 
    enum: ['COURSE', 'INSTITUTION'], 
    index: true 
  },

  institutionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    index: true 
  },

  courseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    index: true 
  },

  day: { 
    type: Date, 
    required: true, 
    index: true 
  }, // stored as YYYY-MM-DD (midnight date)

  // ---- Separate Metrics ----
  views: { type: Number, default: 0 },
  leads: { type: Number, default: 0 },
  callbackRequest: { type: Number, default: 0 },
  bookDemoRequest: { type: Number, default: 0 }

}, { timestamps: true });

// Unique index: Only 1 document per course per day per scope
analyticsDailySchema.index(
  { scope: 1, institutionId: 1, courseId: 1, day: 1 },
  { unique: true }
);

module.exports = mongoose.model('AnalyticsDaily', analyticsDailySchema);

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
	title: { type: String, required: true },
	description: { type: String },
	category: { type: String, enum: ['system','billing','user','security','other','otp'], default: 'other' },
	read: { type: Boolean, default: false },

	recipientType: { type: String, enum: ['STUDENT','INSTITUTION','BRANCH','ADMIN'], required: true },
	student: { type: mongoose.Schema.Types.ObjectId, ref: 'InstituteAdmin' },
	institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' },
	branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
	institutionAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'InstituteAdmin' },

  // Strongly-typed metadata used by clients to deep-link and hydrate UIs
  metadata: {
    type: new mongoose.Schema({
      type: { type: String, trim: true }, // e.g., WELCOME, CALLBACK_REQUEST, NEW_STUDENT
      route: { type: String, trim: true }, // e.g., /dashboard/leads?enquiryId=...
      entity: {
        kind: { type: String, enum: ['STUDENT','PROGRAM','COURSE','ENQUIRY','INSTITUTION','BRANCH','ORDER','SUBSCRIPTION','OTHER'], default: 'OTHER' },
        id: { type: mongoose.Schema.Types.ObjectId, refPath: 'metadata.entity.kind', required: false }
      },
      context: { type: Object } // any additional payload (ids, names, counts)
    }, { _id: false }),
    default: undefined
  },
	// Optional hard TTL; set per category when created
	expiresAt: { type: Date, default: null }
}, { timestamps: true });

NotificationSchema.index({ recipientType: 1 });
NotificationSchema.index({ institutionAdmin: 1 });
NotificationSchema.index({ institution: 1 });
NotificationSchema.index({ branch: 1 });
NotificationSchema.index({ student: 1 });
// TTL on expiresAt so we can expire ONLY read notifications (we set expiresAt when marking read)
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Efficient cursor pagination by createdAt desc, _id desc
NotificationSchema.index({ createdAt: -1, _id: -1 });
NotificationSchema.index({ 'metadata.type': 1 });


module.exports = mongoose.model('Notification', NotificationSchema); 
const Notification = require('../models/Notification');
const { Institution } = require('../models/Institution');

// Utility: build recipient filter from query and auth context
function buildScopeFilter(req) {
  const { scope, studentId, institutionId, branchId } = req.query;
  // For admins, we can infer institutionAdmin from req.user if available
  const filter = {};
  if (scope === 'student' && studentId) { filter.recipientType = 'STUDENT'; filter.student = studentId; }
  else if (scope === 'institution' && institutionId) { filter.recipientType = 'INSTITUTION'; filter.institution = institutionId; }
  else if (scope === 'branch' && branchId) { filter.recipientType = 'BRANCH'; filter.branch = branchId; }
  else if (scope === 'admin' && (req.user?.id || req.query.institutionAdminId)) { filter.recipientType = 'ADMIN'; filter.institutionAdmin = req.user?.id || req.query.institutionAdminId; }
  else { filter.recipientType = { $in: ['SYSTEM', 'ADMIN', 'INSTITUTION', 'BRANCH', 'STUDENT'] }; }
  return filter;
}

exports.list = async function (req, res) {
  try {
    const { page = 1, limit = 20, unread, category, cursor } = req.query;

    // STRICT AUTHENTICATION CHECK
    // Middleware sets req.userId and req.userRole
    const userId = req.userId;
    const userRole = (req.userRole || '').toUpperCase();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const filter = {};

    // 1. Role-based Isolation Logic
    if (userRole === 'STUDENT') {
      filter.recipientType = 'STUDENT';
      filter.student = userId;
    } else if (userRole === 'INSTITUTE_ADMIN' || userRole === 'INSTITUTION_ADMIN') {
      // Find the linked institution for this admin
      // Find the linked institution for this admin
      const institution = await Institution.findOne({ institutionAdmin: userId }).select('_id');

      if (institution) {
        // Admin sees: Direct Admin messages OR Institution-wide broadcasts
        filter.$or = [
          { recipientType: 'ADMIN', institutionAdmin: userId },
          { recipientType: 'INSTITUTION', institution: institution._id }
        ];
      } else {
        // No institution linked? Only see personal admin messages
        filter.recipientType = 'ADMIN';
        filter.institutionAdmin = userId;
      }
    } else if (userRole === 'ADMIN') {
      // Super Admin or Platform Admin - restrict to their personal ID for now
      filter.recipientType = 'ADMIN';
      filter.institutionAdmin = userId;
    } else {
      // Unknown role -> Access Denied
      return res.status(403).json({ success: false, message: 'Access Denied: Unknown Role' });
    }

    // 2. Additional Filters (Client-side params)
    if (typeof unread !== 'undefined') filter.read = unread === 'true' ? false : true;
    if (category) filter.category = category;

    const lim = Math.min(100, parseInt(limit));

    // Cursor-based pagination (createdAt desc, _id desc)
    let items;
    if (cursor) {
      // ... same pagination logic ...
      try {
        const [tsStr, idStr] = String(cursor).split('_');
        const ts = new Date(tsStr);
        const _id = idStr;
        // Merge cursor criteria into the strict filter
        // If we used $or for role logic, we need to wrap it carefully using $and

        const cursorCriteria = {
          $or: [
            { createdAt: { $lt: ts } },
            { createdAt: ts, _id: { $lt: _id } }
          ]
        };

        // Combine logic: (Role Filter) AND (Cursor Criteria) AND (Other filters)
        // Mongoose find(obj) merges keys with AND by default unless keys overlap.
        // We might have $or in 'filter' (for admins). We must be careful not to overwrite it.
        // Simplest way: use $and top-level if needed.

        let finalQuery = { ...filter };
        if (filter.$or) {
          // We already have an $or (for Institution|Admin).
          // We need to AND it with the cursor $or.
          // MongoDB allows $and: [ { $or: ... }, { $or: ... } ]
          finalQuery = {
            $and: [
              { $or: filter.$or },
              cursorCriteria
            ]
          };
          // Copy other scalar props (read, category) if any
          if (filter.read !== undefined) finalQuery.read = filter.read;
          if (filter.recipientType) finalQuery.recipientType = filter.recipientType; // (won't exist if we used $or)
          if (filter.category) finalQuery.category = filter.category;
        } else {
          // Standard merge
          Object.assign(finalQuery, cursorCriteria);
        }

        items = await Notification.find(finalQuery).sort({ createdAt: -1, _id: -1 }).limit(lim);
      } catch {
        // Fallback for bad cursor
        items = await Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(lim);
      }
    } else {
      items = await Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(lim);
    }

    const next = items.length === lim ? `${items[items.length - 1].createdAt.toISOString()}_${items[items.length - 1]._id}` : null;
    res.json({ success: true, data: { items, nextCursor: next, limit: lim } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.create = async function (req, res) {
  try {
    const { title, description, category, recipientType, student, institution, branch, institutionAdmin, metadata } = req.body;
    // Basic metadata normalization for production-level deep links
    const norm = Object.assign({}, metadata || {});
    if (!norm.type) {
      // derive type from category if not provided
      const c = (category || '').toString().toUpperCase();
      if (c === 'USER') norm.type = 'WELCOME';
    }
    if (!norm.route) {
      const t = (norm.type || '').toString().toUpperCase();
      if (t === 'CALLBACK_REQUEST') norm.route = '/dashboard/leads';
      else if (t === 'NEW_STUDENT') norm.route = '/dashboard';
      else norm.route = '/notifications';
    }
    /* Set expiresAt per policy
    const now = Date.now();
    const ttlByCategoryMs = {
      otp: 5 * 60 * 1000,
      system: 30 * 24 * 60 * 60 * 1000,
      billing: 180 * 24 * 60 * 60 * 1000,
      security: 90 * 24 * 60 * 60 * 1000,
      user: 30 * 24 * 60 * 60 * 1000,
      other: 60 * 24 * 60 * 60 * 1000
    };
    const ttl = ttlByCategoryMs[(category || 'other').toLowerCase()] || ttlByCategoryMs.other;
    const expiresAt = new Date(now + ttl);
    const doc = await Notification.create({ title, description, category, recipientType, student, institution, branch, institutionAdmin, metadata, expiresAt });*/
    // Global policy: 7-day retention handled by TTL on createdAt
    // Enqueue for async processing (jobs)
    try {
      const { addNotificationJob } = require('../jobs/notification.job');
      await addNotificationJob({ title, description, category, recipientType, student, institution, branch, institutionAdmin, metadata: norm });
    } catch (e) {
      console.error('Enqueue notification failed, falling back to direct create');
      const doc = await Notification.create({ title, description, category, recipientType, student, institution, branch, institutionAdmin, metadata: norm });
      try {
        const io = req.app.get('io');
        if (io) {
          if (recipientType === 'INSTITUTION' && institution) io.to(`institution:${institution}`).emit('notificationCreated', { notification: doc });
          if (recipientType === 'ADMIN' && institutionAdmin) io.to(`institutionAdmin:${institutionAdmin}`).emit('notificationCreated', { notification: doc });
          if (recipientType === 'STUDENT' && student) io.to(`student:${student}`).emit('notificationCreated', { notification: doc });
          if (recipientType === 'BRANCH' && branch) io.to(`branch:${branch}`).emit('notificationCreated', { notification: doc });
        }
      } catch { }
      return res.json({ success: true, data: doc });
    }
    res.json({ success: true, data: { enqueued: true } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

exports.markRead = async function (req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'ids required' });

    // Get notifications first to identify rooms
    const notifications = await Notification.find({ _id: { $in: ids } });

    const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await Notification.updateMany({ _id: { $in: ids } }, { $set: { read: true, expiresAt: expireAt } });

    try {
      const io = req.app.get('io');
      if (io) {
        notifications.forEach(note => {
          let room = null;
          if (note.recipientType === 'INSTITUTION' && note.institution) room = `institution:${note.institution}`;
          else if (note.recipientType === 'ADMIN' && note.institutionAdmin) room = `institutionAdmin:${note.institutionAdmin}`;
          else if (note.recipientType === 'STUDENT' && note.student) room = `student:${note.student}`;
          else if (note.recipientType === 'BRANCH' && note.branch) room = `branch:${note.branch}`;

          if (room) {
            io.to(room).emit('notificationUpdated', { notificationId: note._id, read: true });
          }
        });
      }
    } catch (_) { }
    res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// markUnread removed per policy

exports.remove = async function (req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'ids required' });

    // Get notifications first to identify rooms
    const notifications = await Notification.find({ _id: { $in: ids } });

    const result = await Notification.deleteMany({ _id: { $in: ids } });
    try {
      const io = req.app.get('io');
      if (io) {
        notifications.forEach(note => {
          let room = null;
          if (note.recipientType === 'INSTITUTION' && note.institution) room = `institution:${note.institution}`;
          else if (note.recipientType === 'ADMIN' && note.institutionAdmin) room = `institutionAdmin:${note.institutionAdmin}`;
          else if (note.recipientType === 'STUDENT' && note.student) room = `student:${note.student}`;
          else if (note.recipientType === 'BRANCH' && note.branch) room = `branch:${note.branch}`;

          if (room) {
            io.to(room).emit('notificationRemoved', { notificationId: note._id });
          }
        });
      }
    } catch (_) { }
    res.json({ success: true, data: { removed: result.deletedCount } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Get count of unread notifications for authenticated user
exports.getUnreadCount = async function (req, res) {
  try {
    const userId = req.userId;
    const userRole = (req.userRole || '').toUpperCase();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let filter = { read: false };

    // Role-based filtering (same logic as list)
    if (userRole === 'STUDENT') {
      filter.recipientType = 'STUDENT';
      filter.student = userId;
    } else if (userRole === 'INSTITUTE_ADMIN' || userRole === 'INSTITUTION_ADMIN') {
      const institution = await Institution.findOne({ institutionAdmin: userId }).select('_id');
      if (institution) {
        filter.$or = [
          { recipientType: 'ADMIN', institutionAdmin: userId, read: false },
          { recipientType: 'INSTITUTION', institution: institution._id, read: false }
        ];
        delete filter.read; // Already in $or conditions
      } else {
        filter.recipientType = 'ADMIN';
        filter.institutionAdmin = userId;
      }
    } else if (userRole === 'ADMIN') {
      filter.recipientType = 'ADMIN';
      filter.institutionAdmin = userId;
    } else {
      return res.status(403).json({ success: false, message: 'Access Denied: Unknown Role' });
    }

    const count = await Notification.countDocuments(filter);
    res.json({ success: true, data: { count } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Mark all notifications as read for authenticated user
exports.markAllRead = async function (req, res) {
  try {
    const userId = req.userId;
    const userRole = (req.userRole || '').toUpperCase();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let filter = { read: false };

    // Role-based filtering (same logic as list)
    if (userRole === 'STUDENT') {
      filter.recipientType = 'STUDENT';
      filter.student = userId;
    } else if (userRole === 'INSTITUTE_ADMIN' || userRole === 'INSTITUTION_ADMIN') {
      const institution = await Institution.findOne({ institutionAdmin: userId }).select('_id');
      if (institution) {
        filter.$or = [
          { recipientType: 'ADMIN', institutionAdmin: userId, read: false },
          { recipientType: 'INSTITUTION', institution: institution._id, read: false }
        ];
        delete filter.read;
      } else {
        filter.recipientType = 'ADMIN';
        filter.institutionAdmin = userId;
      }
    } else if (userRole === 'ADMIN') {
      filter.recipientType = 'ADMIN';
      filter.institutionAdmin = userId;
    } else {
      return res.status(403).json({ success: false, message: 'Access Denied: Unknown Role' });
    }

    const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await Notification.updateMany(filter, { $set: { read: true, expiresAt: expireAt } });

    // Emit socket events for bulk read
    try {
      const io = req.app.get('io');
      if (io) {
        if (userRole === 'STUDENT') {
          io.to(`student:${userId}`).emit('notificationsBulkRead', { count: result.modifiedCount });
        } else if (userRole === 'INSTITUTE_ADMIN' || userRole === 'INSTITUTION_ADMIN') {
          io.to(`institutionAdmin:${userId}`).emit('notificationsBulkRead', { count: result.modifiedCount });
        } else if (userRole === 'ADMIN') {
          io.to(`admin:${userId}`).emit('notificationsBulkRead', { count: result.modifiedCount });
        }
      }
    } catch (_) { }

    res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

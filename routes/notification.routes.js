const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');

// GET /v1/notifications?scope=student|institution|branch|admin&studentId=...&institutionId=...&branchId=...&institutionAdminId=...&page=1&limit=20&unread=true
router.get('/', notificationController.list);

// POST /v1/notifications
router.post('/', notificationController.create);

// POST /v1/notifications/read
router.post('/read', notificationController.markRead);

// GET /v1/notifications/unread-count - Get count of unread notifications
router.get('/unread-count', notificationController.getUnreadCount);

// PATCH /v1/notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', notificationController.markAllRead);

// DELETE /v1/notifications
router.delete('/', notificationController.remove);

module.exports = router; 
const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(
        {
            err: {
                name: err.name,
                message: err.message,
                stack: err.stack,
            },
            req: {
                id: req.id,
                method: req.method,
                url: req.originalUrl,
                user: req.user ? { id: req.user.id } : 'unauthenticated',
            },
        },
        `Unhandled error occurred for request: ${req.id}`
    );

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(el => el.message);
        const message = `Invalid input data. ${errors.join('. ')}`;
        return res.status(400).json({ status: 'fail', message });
    }
    
    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
        const message = `Duplicate field value: ${value}. Please use another value!`;
        return res.status(409).json({ status: 'fail', message });
    }

    // Default to 500 server error
    return res.status(500).json({
        status: 'error',
        message: 'An internal server error occurred. Our team has been notified.',
    });
};

module.exports = errorHandler;
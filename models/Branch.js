const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    branchName: {
        type: String,
        required: [true, 'Branch name is required.'],
        trim: true,
        maxlength: [100, 'Branch name cannot exceed 100 characters.']
    },
    contactInfo: {
        type: String,
        required: [true, 'Contact number is required.'],
        trim: true,
        match: [/^\d{10}$/, 'Please provide a valid contact number.']
    },
    branchAddress: {
        type: String,
        required: [true, 'Branch address is required.'],
        trim: true,
        maxlength: [255, 'Branch address cannot exceed 255 characters.']
    },
    locationUrl: {
        type: String,
        trim: true,
        // match: [/^https?:\/\/.+/, 'Please provide a valid URL.']
    },
    institution: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institution',
        required: true,
        index: true,
    }
}, { timestamps: true });

const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch;
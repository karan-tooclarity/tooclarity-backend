const express = require('express');
const branchController = require('../controllers/branch.controller');
const { validateBranchCreation, validateBranchUpdate } = require('../middleware/validators');

const router = express.Router({ mergeParams: true });

router.route('/')
    .post(branchController.createBranch)
    .get(branchController.getAllBranchesForInstitution);

router.route('/:branchId')
    .get(branchController.getBranchById)
    .put(validateBranchUpdate, branchController.updateBranch)
    .delete(branchController.deleteBranch);

module.exports = router;
const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sequelize = require('sequelize');
const op = sequelize.Op;
const jwt = require('express-jwt');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');

const config = require("config");
const WorkflowUtils = require('../util/workflow');

/**
 * @swagger
 * /phenoflow/tbc/addPhenotype:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create a new Trace-based clustering phenotype.
 *     description: Create a phenotype definition based on the Trace-based clustering technique.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               k:
 *                 type: integer
 *                 description: number of partitions to generated from the input dataset
 *                 minimum: 2
 *               clustering_algorithm:
 *                 type: string
 *                 description: clustering algorithm to apply over the input dataset
 *                 enum: [kmeans]
 *               match_function:
 *                 type: string
 *                 description: match function to apply between the clusters of different partitions
 *                 enum: [jaccard, jaccard2, dice]
 *               random_seed:
 *                 type: integer
 *                 description: seed for the generation of random numbers
 *                 minimum: 0
 *               name:
 *                 type: string
 *                 description: the name of the new definition
 *                 example: tbc001
 *               about:
 *                 type: string
 *                 description: a description of the new definition
 *                 example: trace-based clustering with k=200 and random_seed=34
 *               userName:
 *                 type: string
 *                 description: the name of a pre-registered author to whom the definition should be attributed
 *                 example: antoniolopezmc
 *     responses:
 *       200:
 *         description: Definition added
 */
 router.post('/addPhenotype', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
    req.setTimeout(0);
    if ( !req.body.k || !req.body.clustering_algorithm || !req.body.match_function || !req.body.random_seed || !req.body.name || !req.body.about || !req.body.userName ) {
        return res.status(500).send("Missing parameters.")
    }
    if( req.body.k < 2 ) {
        return res.status(500).send("Error: k parameter must be greater or equal than 2.")
    }
    const valid_clustering_algorithms = new Set(['kmeans'])
    if ( !valid_clustering_algorithms.has(req.body.clustering_algorithm) ) {
        return res.status(500).send("Error: clustering_algorithm parameter is not valid (see documentation).")
    }
    const valid_match_functions = new Set(['jaccard', 'jaccard2', 'dice'])
    if ( !valid_match_functions.has(req.body.match_function) ) {
        return res.status(500).send("Error: match_function parameter is not valid (see documentation).")
    }
    if ( req.body.random_seed < 0 ) {
        return res.status(500).send("Error: random_seed parameter must be greater or equal than 0.")
    }






    // Create a new workflow.
    try {
        var workflow = await models.workflow.create({name:req.body.name, about:req.body.about, userName:sanitizeHtml(req.body.userName)});
        var workflow_id = workflow.id;
    } catch(error) {
        error = "Error creating workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send("Error creating workflow: " + error);
    }
    // Create a new step and add it to the previous workflow.



    //await WorkflowUtils.workflowComplete(workflow_id);
    return res.sendStatus(200);
});

module.exports = router;

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
 *                 type: number
 *                 description: seed for the generation of random numbers
 *                 minimum: 0
 *               replace:
 *                 type: boolean
 *                 description: if replace is true and the phenotype name already exists, the phenotype will be completely replaced; if replace is false and the phenotype name already exists, an HTTP 500 response code will be returned
 *               name:
 *                 type: string
 *                 description: the name of the new definition
 *                 example: tbc001
 *               about:
 *                 type: string
 *                 description: a description of the new definition
 *                 example: trace-based clustering with k=200, clustering_algorithm=kmeans, match_function=dice and random_seed=34
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
    if ( !req.body.k || !req.body.clustering_algorithm || !req.body.match_function || !req.body.random_seed || !req.body.replace || !req.body.name || !req.body.about || !req.body.userName ) {
        return res.status(500).send("Missing parameters (see documentation).")
    }
    var req_body_k = Number.parseInt(req.body.k)
    if( !Number.isInteger(req_body_k) || (req_body_k < 2) ) {
        return res.status(500).send("Error: k parameter must be an integer greater or equal than 2.")
    }
    const valid_clustering_algorithms = new Set(['kmeans'])
    if ( !valid_clustering_algorithms.has(req.body.clustering_algorithm) ) {
        return res.status(500).send("Error: clustering_algorithm parameter is not valid (see documentation).")
    }
    const valid_match_functions = new Set(['jaccard', 'jaccard2', 'dice'])
    if ( !valid_match_functions.has(req.body.match_function) ) {
        return res.status(500).send("Error: match_function parameter is not valid (see documentation).")
    }
    var req_body_random_seed = Number.parseFloat(req.body.random_seed)
    if ( Number.isNaN(req_body_random_seed) || (req_body_random_seed < 0) ) {
        return res.status(500).send("Error: random_seed parameter must be greater or equal than 0.")
    }
    if ( (req.body.replace.toLowerCase() !== "true") && (req.body.replace.toLowerCase() !== "false") ) {
        return res.status(500).send("Error: replace parameter is not valid (see documentation).")
    }
    // Check whether the Trace-based clustering phenotype already exists.
    // IMPORTANT: in this point, either no workflow of this type exists or only one exists.
    // - Other workflows with the same name could exist, but they do not correspond to the Trace-based clustering technique (i.e., they were created using other endpoints).
    try { 
        var workflow = await models.workflow.findOne({where:{name:req.body.name}});
    } catch(error) {
        error = "Error finding workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    if ( (req.body.replace.toLowerCase() === "true") && (workflow) ) {
        // If the phenotype/workflow exists and replace is true, the phenotype/workflow is deleted (and the rest of stuffs, since CASCADE was established).
        // IMPORTANT: if other workflows with the same name were previously created using other endpoints, all will be deleted.
        try {
            await models.workflow.destroy({where:{name:req.body.name}});
        } catch(error) {
            error = "Error destroying workflows: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
            logger.debug(error);
            return res.status(500).send(error);
        }
    } else if ( (req.body.replace.toLowerCase() === "false") && (workflow) ) {
        // If the phenotype/workflow exists and replace is false, an HTTP 500 response code will be returned.
        return res.status(500).send("There is aldeady a phenotype with the same name.")
    }
    // Create a new workflow.
    try {
        var workflow = await models.workflow.create({name:req.body.name, about:req.body.about, userName:sanitizeHtml(req.body.userName)});
        var workflow_id = workflow.id;
    } catch(error) {
        error = "Error creating workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Create the needed steps (with their inputs, outputs and implememtations) and add them to the previous workflow.
    // Step 1: read data from a .csv file (load type).
    var step_name = "read_initial_dataset"
    var step_description = "Read the initial dataset from a .csv file."
    var step_type = "load"
    try {
        var step = await models.step.create({name:step_name, doc:step_description, type:step_type, workflowId:workflow_id, position:1});
        var step_id = step.id
    } catch(error) {
        error = "Error creating step 1: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Step N: write data to a csv file (output type).


    //await WorkflowUtils.workflowComplete(workflow_id);
    return res.sendStatus(200);
});

module.exports = router;

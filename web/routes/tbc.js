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
const path = require('path');

/**
 * @swagger
 * /phenoflow/tbc/addPhenotype:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create a new Trace-based clustering phenotype.
 *     description: Create a phenotype definition based on the Trace-based clustering technique ( PAPER NAME -> A methodology based on Trace based clustering for patient phenotyping , DOI -> doi.org/10.1016/j.knosys.2021.107469 , GITHUB REPO -> github.com/antoniolopezmc/A-methodology-based-on-Trace-based-clustering-for-patient-phenotyping ).
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
 *               threshold:
 *                 type: number
 *                 description: minimum threshold value used to filter and obtain the final candidate clusters
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
    if ( !req.body.k || !req.body.clustering_algorithm || !req.body.match_function || !req.body.random_seed || !req.body.threshold || !req.body.replace || !req.body.name || !req.body.about || !req.body.userName ) {
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
    var req_body_threshold = Number.parseFloat(req.body.threshold)
    if ( Number.isNaN(req_body_threshold) ) {
        return res.status(500).send("Error: threshold parameter is not valid (see documentation).")
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
    // Create the initial needed folders to store the implementation files.
    implementation_files_folder_path = "uploads/" + workflow_id + "/python"
    try {
        await fs.stat(implementation_files_folder_path);
    } catch(error) {
        try {
            await fs.mkdir(implementation_files_folder_path, {recursive:true});
        } catch(error) {
            error = "Error creating the initial needed folders to store the implementation files: " + error;
            logger.debug(error);
            return res.status(500).send(error);
        }
    }
    // Create the needed steps (with their inputs, outputs and implememtations) and add them to the previous workflow.
    // Step 1: LOAD STEP: we suppose that the initial dataset (a .csv file) is already preprocessed and without missing values.
    var step_name = "step_1_load"
    var step_description = "Read the initial dataset from the .csv file. We suppose that this dataset is already preprocessed and without missing values. Remember that all attributes must be numeric, since a clustering technique will be applied."
    var step_type = "load"
    try {
        var step = await models.step.create({name:step_name, doc:step_description, type:step_type, workflowId:workflow_id, position:1});
        var step_id = step.id
    } catch(error) {
        error = "Error creating step 1: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.input.create({doc:"A .csv file containing a dataset in csv format. We suppose that this dataset is already preprocessed and without missing values. Remember that all attributes must be numeric, since a clustering technique will be applied.", stepId:step_id});
    } catch(error) {
        error = "Error creating the input for step 1: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.output.create({doc:"The same .csv file, since the dataset is already preprocessed and in csv format.", extension:"csv", stepId:step_id});
    } catch(error) {
        error = "Error creating the output for step 1: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    source_implementation_file_path = "templates/tbc/step1.py"
    dest_implementation_file_path = implementation_files_folder_path + "/step1.py"
    try{
        // Flag 0 -> dest is overwritten if it already exists.
        await fs.copyFile(source_implementation_file_path, dest_implementation_file_path, 0);
    } catch(error) {
        error = "Error creating the implementation file for the step 1: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.implementation.create({fileName:dest_implementation_file_path, language:"python", stepId:step_id});
    } catch(error) {
        error = "Error creating the implementation for step 1: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Step 2: apply the corresponding clustering algorithm (k-1 times) over the dataset in order to obtain all partitions.
    var step_name = "step_2_from_dataset_to_partitions"
    var step_description = "Read the csv dataset and apply the corresponding clustering algorithm (k-1 times) in order to obtain all partitions."
    var step_type = "logic"
    try {
        var step = await models.step.create({name:step_name, doc:step_description, type:step_type, workflowId:workflow_id, position:2});
        var step_id = step.id
    } catch(error) {
        error = "Error creating step 2: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.input.create({doc:"The csv dataset over which the corresponding clustering algorithm will be applied (k-1 times) in order to obtain all partitions.", stepId:step_id});
    } catch(error) {
        error = "Error creating the input for step 2: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.output.create({doc:"A json file containing all partitions generated (each cluster of each partition stores a list with the indices of the instances belonging to that cluster).", extension:"json", stepId:step_id});
    } catch(error) {
        error = "Error creating the output for step 2: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    source_implementation_file_path = "templates/tbc/step2.py"
    dest_implementation_file_path = implementation_files_folder_path + "/step2.py"
    try{
        source_file_content = await fs.readFile(source_implementation_file_path, "utf8")
        // We have to do replacements depending on the value of the 'clustering_algorithm' parameter.
        regex = /<CLUSTERING_ALGORITHM_NAME>|<RANDOM_SEED_PARAMETER>|<K_PARAMETER>|<CLUSTERING_ALGORITHM_CALL>/g
        if (req.body.clustering_algorithm === "kmeans") {
            new_source_file_content = source_file_content.replaceAll(regex, (match) => {
                if (match === "<CLUSTERING_ALGORITHM_NAME>") {
                    return "KMeans"
                } else if (match === "<RANDOM_SEED_PARAMETER>") {
                    return req_body_random_seed.toString()
                } else if (match === "<K_PARAMETER>") {
                    return req_body_k.toString()
                } else if (match === "<CLUSTERING_ALGORITHM_CALL>") {
                    return "KMeans(n_clusters=number_of_clusters, random_state=current_random_seed).fit(pandas_dataframe)"
                } else {
                    return match;
                }
            });
        }
        await fs.writeFile(dest_implementation_file_path, new_source_file_content, "utf8");
    } catch(error) {
        error = "Error creating the implementation file for the step 2: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.implementation.create({fileName:dest_implementation_file_path, language:"python", stepId:step_id});
    } catch(error) {
        error = "Error creating the implementation for step 2: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Step 3: obtain the matrix of matches using all partitions generated previously.
    var step_name = "step_3_from_partitions_to_matrix_of_matches"
    var step_description = "Read the json file containing the partitions and generate the matrix of matches in json format."
    var step_type = "logic"
    try {
        var step = await models.step.create({name:step_name, doc:step_description, type:step_type, workflowId:workflow_id, position:3});
        var step_id = step.id
    } catch(error) {
        error = "Error creating step 3: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.input.create({doc:"A json file containing all partitions generated in the previous step (each cluster of each partition stores a list with the indices of the instances belonging to that cluster).", stepId:step_id});
    } catch(error) {
        error = "Error creating the input for step 3: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.output.create({doc:"A json file containing the matrix of matches.", extension:"json", stepId:step_id});
    } catch(error) {
        error = "Error creating the output for step 3: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    source_implementation_file_path = "templates/tbc/step3.py"
    dest_implementation_file_path = implementation_files_folder_path + "/step3.py"
    try{
        source_file_content = await fs.readFile(source_implementation_file_path, "utf8")
        // We have to do replacements depending on the value of the 'match_function' parameter.
        regex = /<K_PARAMETER>|<VALUE_OF_MATCH_CALCULATION>/g
        if (req.body.match_function === "jaccard") {
            new_source_file_content = source_file_content.replaceAll(regex, (match) => {
                if (match === "<K_PARAMETER>") {
                    return req_body_k.toString()
                } else if (match === "<VALUE_OF_MATCH_CALCULATION>") {
                    return "len( cluster_of_partition_k.intersection(cluster_of_current_partition) ) / len( cluster_of_partition_k.union(cluster_of_current_partition) )"
                } else {
                    return match;
                }
            });
        } else if (req.body.match_function === "jaccard2") {
            new_source_file_content = source_file_content.replaceAll(regex, (match) => {
                if (match === "<K_PARAMETER>") {
                    return req_body_k.toString()
                } else if (match === "<VALUE_OF_MATCH_CALCULATION>") {
                    return "len( cluster_of_partition_k.intersection(cluster_of_current_partition) ) / len( cluster_of_current_partition )"
                } else {
                    return match;
                }
            });
        } else if (req.body.match_function === "dice") {
            new_source_file_content = source_file_content.replaceAll(regex, (match) => {
                if (match === "<K_PARAMETER>") {
                    return req_body_k.toString()
                } else if (match === "<VALUE_OF_MATCH_CALCULATION>") {
                    return "(2*len(cluster_of_partition_k.intersection(cluster_of_current_partition))) / (len(cluster_of_partition_k)+len(cluster_of_current_partition))"
                } else {
                    return match;
                }
            });
        }
        await fs.writeFile(dest_implementation_file_path, new_source_file_content, "utf8");
    } catch(error) {
        error = "Error creating the implementation file for the step 3: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.implementation.create({fileName:dest_implementation_file_path, language:"python", stepId:step_id});
    } catch(error) {
        error = "Error creating the implementation for step 3: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    
    // Step 4: filter the matrix of matches in order to obtain the final candidate clusters.

    // Step 5: OUTPUT STEP: write final data to a .csv file.

    //await WorkflowUtils.workflowComplete(workflow_id);
    return res.sendStatus(200);
});

module.exports = router;

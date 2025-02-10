const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sequelize = require('sequelize');
const op = sequelize.Op;
const jwt = require('express-jwt');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');
const AdmZip = require('adm-zip');
const got = require("got");

const config = require("config");
const WorkflowUtils = require('../util/workflow');
const path = require('path');

/**
 * @swagger
 * /phenoflow/tbc/addPhenotype:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create a new Trace-based clustering phenotype
 *     description: Create a phenotype definition based on the Trace-based clustering technique ( PAPER NAME -> A methodology based on Trace based clustering for patient phenotyping , DOI -> doi.org/10.1016/j.knosys.2021.107469 , GITHUB REPO -> github.com/antoniolopezmc/A-methodology-based-on-Trace-based-clustering-for-patient-phenotyping )
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               k:
 *                 type: integer
 *                 description: Number of partitions to generated from the input dataset
 *                 minimum: 2
 *               clustering_algorithm:
 *                 type: string
 *                 description: Clustering algorithm to apply over the input dataset
 *                 enum: [kmeans]
 *               match_function:
 *                 type: string
 *                 description: Match function to apply between the clusters of different partitions
 *                 enum: [jaccard, jaccard2, dice]
 *               random_seed:
 *                 type: number
 *                 description: Seed for the generation of random numbers
 *                 minimum: 0
 *               threshold:
 *                 type: number
 *                 description: Minimum threshold value used to filter and obtain the final candidate clusters
 *               replace:
 *                 type: boolean
 *                 description: If replace is true and the phenotype name already exists, the phenotype will be completely replaced; if replace is false and the phenotype name already exists, an HTTP 500 response code will be returned
 *               name:
 *                 type: string
 *                 description: The name of the new definition
 *                 example: tbc001
 *               about:
 *                 type: string
 *                 description: A description of the new definition
 *                 example: trace-based clustering with k=200, clustering_algorithm=kmeans, match_function=dice and random_seed=34
 *               userName:
 *                 type: string
 *                 description: The name of a pre-registered author to whom the definition should be attributed
 *                 example: antoniolopezmc
 *     responses:
 *       200:
 *         description: Definition added
 *       500:
 *         description: Some error occurred
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
        return res.status(500).send("There is already a phenotype with the same name.")
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
    implementation_file_name = "step1.py"
    source_implementation_file_path = "templates/tbc/" + implementation_file_name
    dest_implementation_file_path = implementation_files_folder_path + "/" + implementation_file_name
    try{
        source_file_content = await fs.readFile(source_implementation_file_path, "utf8")
        // We have to replace using the value of the 'name' parameter and of the workflow ID.
        regex = /<WORKFLOW_NAME>|<WORKFLOW_ID>/g
        new_source_file_content = source_file_content.replaceAll(regex, (match) => {
            if (match === "<WORKFLOW_NAME>") {
                return req.body.name;
            } else if (match === "<WORKFLOW_ID>") {
                return workflow_id.toString()
            } else {
                return match;
            }
        });
        await fs.writeFile(dest_implementation_file_path, new_source_file_content, "utf8");   
    } catch(error) {
        error = "Error creating the implementation file for the step 1: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.implementation.create({fileName:implementation_file_name, language:"python", stepId:step_id});
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
    implementation_file_name = "step2.py"
    source_implementation_file_path = "templates/tbc/" + implementation_file_name
    dest_implementation_file_path = implementation_files_folder_path + "/" + implementation_file_name
    try{
        source_file_content = await fs.readFile(source_implementation_file_path, "utf8")
        // We have to replace depending on the value of the 'clustering_algorithm' parameter.
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
        await models.implementation.create({fileName:implementation_file_name, language:"python", stepId:step_id});
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
    implementation_file_name = "step3.py"
    source_implementation_file_path = "templates/tbc/" + implementation_file_name
    dest_implementation_file_path = implementation_files_folder_path + "/" + implementation_file_name
    try{
        source_file_content = await fs.readFile(source_implementation_file_path, "utf8")
        // We have to replace depending on the value of the 'match_function' parameter.
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
        await models.implementation.create({fileName:implementation_file_name, language:"python", stepId:step_id});
    } catch(error) {
        error = "Error creating the implementation for step 3: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Step 4: filter the matrix of matches in order to obtain the final candidate clusters.
    var step_name = "step_4_from_matrix_of_matches_to_final_candidate_clusters"
    var step_description = "Read the json file containing the matrix of matches and filter it in order to obtain the final candidate clusters in json format."
    var step_type = "logic"
    try {
        var step = await models.step.create({name:step_name, doc:step_description, type:step_type, workflowId:workflow_id, position:4});
        var step_id = step.id
    } catch(error) {
        error = "Error creating step 4: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.input.create({doc:"A json file containing the matrix of matches generated in the previous step.", stepId:step_id});
    } catch(error) {
        error = "Error creating the input for step 4: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.output.create({doc:"A json file containing the final candidate clusters.", extension:"json", stepId:step_id});
    } catch(error) {
        error = "Error creating the output for step 4: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    implementation_file_name = "step4.py"
    source_implementation_file_path = "templates/tbc/" + implementation_file_name
    dest_implementation_file_path = implementation_files_folder_path + "/" + implementation_file_name
    try{
        source_file_content = await fs.readFile(source_implementation_file_path, "utf8")
        // We have to replace using the value of the 'threshold' parameter.
        new_source_file_content = source_file_content.replaceAll("<THRESHOLD_PARAMETER>", req_body_threshold.toString());
        await fs.writeFile(dest_implementation_file_path, new_source_file_content, "utf8");
    } catch(error) {
        error = "Error creating the implementation file for the step 4: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.implementation.create({fileName:implementation_file_name, language:"python", stepId:step_id});
    } catch(error) {
        error = "Error creating the implementation for step 4: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Step 5: OUTPUT STEP: write the final candidate clusters to a .csv file.
    var step_name = "step_5_output"
    var step_description = "Read the json file containing the final candidate clusters and write them to a .csv file. This .csv file will contain the following three attributes: (1) instance index of the initial dataset (starting from 0), (2) cluster name (starting from 0 and from the partition with more clusters), and (3) mean value of match with previous partitions."
    var step_type = "output"
    try {
        var step = await models.step.create({name:step_name, doc:step_description, type:step_type, workflowId:workflow_id, position:5});
        var step_id = step.id
    } catch(error) {
        error = "Error creating step 5: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.input.create({doc:"A json file containing the final candidate clusters.", stepId:step_id});
    } catch(error) {
        error = "Error creating the input for step 5: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.output.create({doc:"The output .csv file containing the final candidate clusters. This .csv file will contain the following three attributes: (1) instance index of the initial dataset (starting from 0), (2) cluster name (starting from 0 and from the partition with more clusters), and (3) mean value of match with previous partitions.", extension:"csv", stepId:step_id});
    } catch(error) {
        error = "Error creating the output for step 5: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    implementation_file_name = "step5.py"
    source_implementation_file_path = "templates/tbc/" + implementation_file_name
    dest_implementation_file_path = implementation_files_folder_path + "/" + implementation_file_name
    try{
        source_file_content = await fs.readFile(source_implementation_file_path, "utf8")
        // We have to replace using the value of the 'name' parameter and of the workflow ID, as well as the value of the k parameter.
        regex = /<WORKFLOW_NAME>|<WORKFLOW_ID>|<K_PARAMETER>/g
        new_source_file_content = source_file_content.replaceAll(regex, (match) => {
            if (match === "<WORKFLOW_NAME>") {
                return req.body.name;
            } else if (match === "<WORKFLOW_ID>") {
                return workflow_id.toString()
            } else if (match === "<K_PARAMETER>") {
                return req_body_k.toString()
            } else {
                return match;
            }
        });
        await fs.writeFile(dest_implementation_file_path, new_source_file_content, "utf8");   
    } catch(error) {
        error = "Error creating the implementation file for the step 5: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.implementation.create({fileName:implementation_file_name, language:"python", stepId:step_id});
    } catch(error) {
        error = "Error creating the implementation for step 5: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    await WorkflowUtils.workflowComplete(workflow_id);
    return res.sendStatus(200);
});

/**
 * @swagger
 * /phenoflow/tbc/uploadCsvDataset:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Upload a .csv dataset
 *     description: Upload a dataset in CSV format to be used by an specific Trace-based clustering phenotype
 *     parameters:
 *       - in: formData
 *         name: phenotypeName
 *         type: string
 *         required: true
 *         description: Name of the Trace-based clustering phenotype which will use the uploaded dataset
 *       - in: formData
 *         name: uploadedCsvDataset
 *         type: file
 *         required: true
 *         description: Uploaded .csv dataset
 *       - in: formData 
 *         name: replace
 *         type: boolean
 *         description: If replace is true and a dataset with the same name already exists, the file will be replaced; if replace is false and a dataset with the same name already exists, an HTTP 500 response code will be returned
 *     responses:
 *       200:
 *         description: Dataset uploaded
 *       500:
 *         description: Some error occurred
 */
 router.post('/uploadCsvDataset', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
    req.setTimeout(0);
    if ( !req.body.phenotypeName || !req.body.replace || !req.files || !req.files.uploadedCsvDataset ) {
        return res.status(500).send("Missing parameters (see documentation).")
    }
    if (Object.keys(req.files).length ==! 1) {
        return res.status(500).send("Only one file must be uploaded (see documentation).")
    }
    if ( (req.body.replace.toLowerCase() !== "true") && (req.body.replace.toLowerCase() !== "false") ) {
        return res.status(500).send("Error: replace parameter is not valid (see documentation).")
    }
    // Check whether the Trace-based clustering phenotype exists.
    // IMPORTANT: in this point, either no workflow of this type exists or only one exists.
    // - Other workflows with the same name could exist, but they do not correspond to the Trace-based clustering technique (i.e., they were created using other endpoints).
    //   ==> This case should not occur (USERS MUST NOT USE HERE A PHENOTYPE THAT IS NOT OF TRACE-BASED CLUSTERING TYPE) and, therefore, it is not handled.
    try {
        var workflow = await models.workflow.findOne({where:{name:req.body.phenotypeName}});
        var workflow_id = workflow.id;
    } catch(error) {
        error = "Error: workflow with name '" + req.body.phenotypeName + "' does not exist: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Check whether the corresponding folder in 'uploads' exists.
    workflow_folder_path = "uploads/" + workflow_id
    try {
        await fs.stat(workflow_folder_path);
    } catch(error) {
        error = "Error: workflow folder (workflow ID = " + workflow_id + ") does not exist in 'uploads': " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Create a new folder called 'datasets' if it does not exist.
    workflow_datasets_folder_path = workflow_folder_path + "/datasets"
    try {
        await fs.stat(workflow_datasets_folder_path);
    } catch(error) {
        try {
            await fs.mkdir(workflow_datasets_folder_path);
        } catch(error) {
            error = "Error creating the 'datasets' folder: " + error;
            logger.debug(error);
            return res.status(500).send(error);
        }
    }
    // Save the uploaded CSV dataset in 'datasets' folder.
    var uploadedFileObject = req.files.uploadedCsvDataset
    var uploadedDatasetPath = workflow_datasets_folder_path + "/" + uploadedFileObject.name
    // Replace or not depending on the paramter.
    if (req.body.replace.toLowerCase() === "true") {
        try {
            await uploadedFileObject.mv(uploadedDatasetPath)
        } catch(error) {
            error = "Error moving the uploaded dataset to 'datasets' folder: " + error;
            logger.debug(error);
            return res.status(500).send(error);
        }
    } else {
        try {
            await fs.stat(uploadedDatasetPath);
            return res.status(500).send("There is already a dataset with the same name.")
        } catch(error) {
            try {
                await uploadedFileObject.mv(uploadedDatasetPath)
            } catch(error) {
                error = "Error moving the uploaded dataset to 'datasets' folder: " + error;
                logger.debug(error);
                return res.status(500).send(error);
            }
        }
    }
    return res.sendStatus(200);
});

/**
 * @swagger
 * /phenoflow/tbc/generate2/{workflowName}/{datasetName}:
 *   get:
 *     summary: Generate a Trace-based clustering phenotype
 *     description: Generate a phenotype based on the Trace-based clustering technique, indicanting and existing workflow/phenotype name and an existing dataset name (including its extension)
 *     parameters:
 *       - in: path
 *         name: workflowName
 *         type: string
 *         required: true
 *         description: Name of the existing Trace-based clustering phenotype
 *       - in: path
 *         name: datasetName
 *         type: string
 *         required: true
 *         description: Name of the existing dataset (including its extension)
 *     responses:
 *       200:
 *         description: Phenotype generated
 *       500:
 *         description: Some error occurred
 */
router.get("/generate2/:workflowName/:datasetName", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
    if ( !req.params.workflowName || !req.params.datasetName ) {
        return res.status(500).send("Missing parameters (see documentation).")
    }
    // Check whether a workflow defined by the value of 'workflowName' exists.
    // IMPORTANT: since it is a Trace-based clustering phenotype, in this point, either no workflow exists or only one exists.
    // - Other workflows with the same name could exist, but they do not correspond to the Trace-based clustering technique (i.e., they were created using other endpoints).
    //   ==> This case should not occur (USERS MUST NOT USE HERE A PHENOTYPE THAT IS NOT OF TRACE-BASED CLUSTERING TYPE) and, therefore, it is not handled.
    try { 
        var workflow = await models.workflow.findOne({where:{name:req.params.workflowName}});
        var workflow_id = workflow.id;
    } catch(error) {
        error = "Error: workflow with name '" + req.params.workflowName + "' does not exist: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Check whether a dataset called as the value of 'datasetName' exists.
    dataset_uploads_folder_path = "uploads/" + workflow_id + "/datasets/"
    dataset_path = dataset_uploads_folder_path + req.params.datasetName
    try {
        await fs.stat(dataset_path);
    } catch(error) {
        error = "Error: dataset with name '" + req.params.datasetName + "' does not exist in '" + dataset_uploads_folder_path + "' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Create the initial needed folders to store the output files.
    // IMPORTANT: the folder must be new and different in each case, because it must be empty.
    //   - For this reason, we use temporal directories, executing 'fs.mkdtemp' method.
    output_files_folder_path = "output/" + workflow_id + "/"
    try { // First, 'output/{workflow_id}/' recursively, if it does not exist.
        await fs.stat(output_files_folder_path);
    } catch(error) {
        try {
            await fs.mkdir(output_files_folder_path, {recursive:true});
        } catch(error) {
            error = "Error creating the initial needed folders to store the output files: " + error;
            logger.debug(error);
            return res.status(500).send(error);
        }
    }
    try { // Second, a temporal directory inside 'output/{workflow_id}/'.
        tmp_dir = await fs.mkdtemp(output_files_folder_path)
    } catch(error) {
        error = "Error creating the initial needed folders to store the output files: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try { // Third and finally, a directory called as the workflow name, inside the temporal directory.
        await fs.mkdir(tmp_dir + "/" + req.params.workflowName);
    } catch(error) {
        error = "Error creating the initial needed folders to store the output files: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Store the final path for the output files.
    final_output_path = tmp_dir + "/" + req.params.workflowName + "/"
    // Upload folder path.
    uploads_folder_path = "uploads/" + workflow_id + "/python/"
    // Templates folder path.
    templates_folder_path = "templates/tbc/"
    // Copy 'LICENSE.md' file from templates folder.
    try {
        await fs.copyFile(templates_folder_path + 'LICENSE.md', final_output_path + 'LICENSE.md')
    } catch(error) {
        error = "Error copying 'LICENSE.md' file: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy 'README.md' file from templates folder.
    try {
        await fs.copyFile(templates_folder_path + 'README.md', final_output_path + 'README.md')
    } catch(error) {
        error = "Error copying 'README.md' file: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy python files corresponding to all steps from uploads folder.
    try {
        await fs.mkdir(final_output_path + "python");
    } catch(error) {
        error = "Error creating 'python' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await fs.copyFile(uploads_folder_path + 'step1.py', final_output_path + 'python/step1.py')
        await fs.copyFile(uploads_folder_path + 'step2.py', final_output_path + 'python/step2.py')
        await fs.copyFile(uploads_folder_path + 'step3.py', final_output_path + 'python/step3.py')
        await fs.copyFile(uploads_folder_path + 'step4.py', final_output_path + 'python/step4.py')
        await fs.copyFile(uploads_folder_path + 'step5.py', final_output_path + 'python/step5.py')
    } catch(error) {
        error = "Error copying python files: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy the dataset from uploads folder.
    try {
        // IMPORTANT: 'files' folder will contain all files needed and generated in all steps.
        await fs.mkdir(final_output_path + "files");
    } catch(error) {
        error = "Error creating 'files' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await fs.copyFile(dataset_path, final_output_path + 'files/' + req.params.datasetName)
    } catch(error) {
        error = "Error copying the dataset: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy cwl files corresponding to all steps from templates folder.
    try {
        await fs.mkdir(final_output_path + "cwl");
    } catch(error) {
        error = "Error creating 'cwl' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await fs.copyFile(templates_folder_path + 'step1.cwl', final_output_path + 'cwl/step1.cwl')
        await fs.copyFile(templates_folder_path + 'step2.cwl', final_output_path + 'cwl/step2.cwl')
        await fs.copyFile(templates_folder_path + 'step3.cwl', final_output_path + 'cwl/step3.cwl')
        await fs.copyFile(templates_folder_path + 'step4.cwl', final_output_path + 'cwl/step4.cwl')
        await fs.copyFile(templates_folder_path + 'step5.cwl', final_output_path + 'cwl/step5.cwl')
    } catch(error) {
        error = "Error copying the cwl files corresponding to the steps: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy main.cwl file from templates folder.
    try {
        await fs.copyFile(templates_folder_path + 'main.cwl', final_output_path + 'main.cwl')
    } catch(error) {
        error = "Error copying main.cwl file: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Read main.yml file content (from templates folder), replace it appropriately and write.
    try{
        main_yml_file_content = await fs.readFile(templates_folder_path + 'main.yml', "utf8")
        // We have to replace using the dataset name.
        new_main_yml_file_content = main_yml_file_content.replaceAll("<DATASET_NAME>", req.params.datasetName);
        await fs.writeFile(final_output_path + 'main.yml', new_main_yml_file_content, "utf8");
    } catch(error) {
        error = "Error creating main.yml file: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Create the final zip file and send it in the response.
    zip_file_folder = tmp_dir + "/"
    zip_file_name = req.params.workflowName + ".zip"
    zip_file_path = zip_file_folder + zip_file_name
    try { 
        zip = new AdmZip();
        zip.addLocalFolder(zip_file_folder)
        zip.writeZip(zip_file_path)
    } catch(error) {
        error = "Error creating zip file: " + error;
        logger.error(error);
        return res.status(500).send(error);
    }
    // We use 'download' instead of 'sendFile', because we can specify the downloaded file name.
    return res.status(200).download(zip_file_path, zip_file_name);
});

/**
 * @swagger
 * /phenoflow/tbc/generate/{workflowName}/{datasetName}:
 *   get:
 *     summary: Generate a Trace-based clustering phenotype
 *     description: Generate a phenotype based on the Trace-based clustering technique, indicanting and existing workflow/phenotype name and an existing dataset name (including its extension)
 *     parameters:
 *       - in: path
 *         name: workflowName
 *         type: string
 *         required: true
 *         description: Name of the existing Trace-based clustering phenotype
 *       - in: path
 *         name: datasetName
 *         type: string
 *         required: true
 *         description: Name of the existing dataset (including its extension)
 *     responses:
 *       200:
 *         description: Phenotype generated
 *       500:
 *         description: Some error occurred
 */
 router.get("/generate/:workflowName/:datasetName", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
    if ( !req.params.workflowName || !req.params.datasetName ) {
        return res.status(500).send("Missing parameters (see documentation).")
    }
    // Check whether a workflow defined by the value of 'workflowName' exists.
    // IMPORTANT: since it is a Trace-based clustering phenotype, in this point, either no workflow exists or only one exists.
    // - Other workflows with the same name could exist, but they do not correspond to the Trace-based clustering technique (i.e., they were created using other endpoints).
    //   ==> This case should not occur (USERS MUST NOT USE HERE A PHENOTYPE THAT IS NOT OF TRACE-BASED CLUSTERING TYPE) and, therefore, it is not handled.
    try { 
        var workflow = await models.workflow.findOne({where:{name:req.params.workflowName}});
        var workflow_id = workflow.id;
    } catch(error) {
        error = "Error: workflow with name '" + req.params.workflowName + "' does not exist: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Check whether a dataset called as the value of 'datasetName' exists.
    dataset_uploads_folder_path = "uploads/" + workflow_id + "/datasets/"
    dataset_path = dataset_uploads_folder_path + req.params.datasetName
    try {
        await fs.stat(dataset_path);
    } catch(error) {
        error = "Error: dataset with name '" + req.params.datasetName + "' does not exist in '" + dataset_uploads_folder_path + "' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Create the initial needed folders to store the output files.
    // IMPORTANT: the folder must be new and different in each case, because it must be empty.
    //   - For this reason, we use temporal directories, executing 'fs.mkdtemp' method.
    output_files_folder_path = "output/" + workflow_id + "/"
    try { // First, 'output/{workflow_id}/' recursively, if it does not exist.
        await fs.stat(output_files_folder_path);
    } catch(error) {
        try {
            await fs.mkdir(output_files_folder_path, {recursive:true});
        } catch(error) {
            error = "Error creating the initial needed folders to store the output files: " + error;
            logger.debug(error);
            return res.status(500).send(error);
        }
    }
    try { // Second, a temporal directory inside 'output/{workflow_id}/'.
        tmp_dir = await fs.mkdtemp(output_files_folder_path)
    } catch(error) {
        error = "Error creating the initial needed folders to store the output files: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try { // Third and finally, a directory called as the workflow name, inside the temporal directory.
        await fs.mkdir(tmp_dir + "/" + req.params.workflowName);
    } catch(error) {
        error = "Error creating the initial needed folders to store the output files: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Store the final path for the output files.
    final_output_path = tmp_dir + "/" + req.params.workflowName + "/"
    // Upload folder path.
    uploads_folder_path = "uploads/" + workflow_id + "/python/"
    // Templates folder path.
    templates_folder_path = "templates/tbc/"
    // Copy 'LICENSE.md' file from templates folder.
    try {
        await fs.copyFile(templates_folder_path + 'LICENSE.md', final_output_path + 'LICENSE.md')
    } catch(error) {
        error = "Error copying 'LICENSE.md' file: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy 'README.md' file from templates folder.
    try {
        await fs.copyFile(templates_folder_path + 'README.md', final_output_path + 'README.md')
    } catch(error) {
        error = "Error copying 'README.md' file: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy python files corresponding to all steps from uploads folder.
    try {
        await fs.mkdir(final_output_path + "python");
    } catch(error) {
        error = "Error creating 'python' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await fs.copyFile(uploads_folder_path + 'step1.py', final_output_path + 'python/step1.py')
        await fs.copyFile(uploads_folder_path + 'step2.py', final_output_path + 'python/step2.py')
        await fs.copyFile(uploads_folder_path + 'step3.py', final_output_path + 'python/step3.py')
        await fs.copyFile(uploads_folder_path + 'step4.py', final_output_path + 'python/step4.py')
        await fs.copyFile(uploads_folder_path + 'step5.py', final_output_path + 'python/step5.py')
    } catch(error) {
        error = "Error copying python files: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy the dataset from uploads folder.
    try {
        // IMPORTANT: 'files' folder will contain all files needed and generated in all steps.
        await fs.mkdir(final_output_path + "files");
    } catch(error) {
        error = "Error creating 'files' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await fs.copyFile(dataset_path, final_output_path + 'files/' + req.params.datasetName)
    } catch(error) {
        error = "Error copying the dataset: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Call generator endpoint to generate the cwl files corresponding to all steps.
    try {
        await fs.mkdir(final_output_path + "cwl");
    } catch(error) {
        error = "Error creating 'cwl' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        generator_url = config.get("generator.URL") + "/tbc/getStepCwl/1"
        step1_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'cwl/step1.cwl', step1_cwl_file_content, "utf8");
        generator_url = config.get("generator.URL") + "/tbc/getStepCwl/2"
        step2_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'cwl/step2.cwl', step2_cwl_file_content, "utf8");
        generator_url = config.get("generator.URL") + "/tbc/getStepCwl/3"
        step3_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'cwl/step3.cwl', step3_cwl_file_content, "utf8");
        generator_url = config.get("generator.URL") + "/tbc/getStepCwl/4"
        step4_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'cwl/step4.cwl', step4_cwl_file_content, "utf8");
        generator_url = config.get("generator.URL") + "/tbc/getStepCwl/5"
        step5_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'cwl/step5.cwl', step5_cwl_file_content, "utf8");
    } catch(error) {
        error = "Error generating the cwl files corresponding to the steps (" + generator_url + "): " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Call generator endpoint to generate main.cwl file.
    try {
        generator_url = config.get("generator.URL") + "/tbc/getMainCwl"
        main_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'main.cwl', main_cwl_file_content, "utf8");
    } catch(error) {
        error = "Error generating main.cwl file (" + generator_url + "): " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Call generator endpoint to generate main.yml file.
    try {
        generator_url = config.get("generator.URL") + "/tbc/generateMainYml/" + req.params.datasetName
        main_yml_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'main.yml', main_yml_file_content, "utf8");
    } catch(error) {
        error = "Error generating main.yml file (" + generator_url + "): " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Create the final zip file and send it in the response.
    zip_file_folder = tmp_dir + "/"
    zip_file_name = req.params.workflowName + ".zip"
    zip_file_path = zip_file_folder + zip_file_name
    try { 
        zip = new AdmZip();
        zip.addLocalFolder(zip_file_folder)
        zip.writeZip(zip_file_path)
    } catch(error) {
        error = "Error creating zip file: " + error;
        logger.error(error);
        return res.status(500).send(error);
    }
    // We use 'download' instead of 'sendFile', because we can specify the downloaded file name.
    return res.status(200).download(zip_file_path, zip_file_name);
});

module.exports = router;

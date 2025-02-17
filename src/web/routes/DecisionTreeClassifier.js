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
 * /phenoflow/DecisionTreeClassifier/addPhenotype:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Create a new Decision Tree Classifier phenotype
 *     description: Create a phenotype definition based on the Decision Tree Classifier technique (using the scikit-learn implementation).
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               class_name:
 *                 type: string
 *                 description: The name of the attribute that will act as a class (it must be in the train dataset, but may not be in the test dataset)
 *               random_state:
 *                 type: integer
 *                 description: The random seed for the ML algorithm
 *               replace:
 *                 type: boolean
 *                 description: If replace is true and the phenotype name already exists, the phenotype will be completely replaced; if replace is false and the phenotype name already exists, an HTTP 500 response code will be returned
 *               name:
 *                 type: string
 *                 description: The name of the new definition
 *                 example: dtc001
 *               about:
 *                 type: string
 *                 description: A description of the new definition
 *                 example: A phenotype based on the Decision Tree Classifier technique with a random state equal to 5
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
    if ( !req.body.class_name || !req.body.random_state || !req.body.replace || !req.body.name || !req.body.about || !req.body.userName ) {
        return res.status(500).send("Missing parameters (see documentation).")
    }
    var req_body_random_state = Number.parseInt(req.body.random_state)
    if ( Number.isNaN(req_body_random_state) || (req_body_random_state < 0) ) {
        return res.status(500).send("Error: random_state parameter must be greater or equal than 0.")
    }
    if ( (req.body.replace.toLowerCase() !== "true") && (req.body.replace.toLowerCase() !== "false") ) {
        return res.status(500).send("Error: replace parameter is not valid (see documentation).")
    }
    // Check whether the phenotype already exists.
    // IMPORTANT: in this point, either no workflow of this type exists or only one exists.
    // - Other workflows with the same name could exist, but they do not correspond to the current ML technique (i.e., they were created using other endpoints).
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
    // Step 1: LOAD STEP: we suppose that the initial datasets (.csv files) are already preprocessed, without missing values and with the correct attributes.
    var step_name = "step_1_load"
    var step_description = "Read the initial datasets (train and test) from the .csv files. We suppose that these datasets are already preprocessed, without missing values and with the correct attributes. Remember that all attributes (except the class) must be numeric."
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
        await models.input.create({doc:"The train and test datasets (in .csv format). We suppose that these datasets are already preprocessed, without missing values and with the correct attributes. Remember that all attributes (except the class) must be numeric.", stepId:step_id});
    } catch(error) {
        error = "Error creating the input for step 1: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.output.create({doc:"The same .csv files, since the datasets are already preprocessed and in csv format.", extension:"csv", stepId:step_id});
    } catch(error) {
        error = "Error creating the output for step 1: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    implementation_file_name = "step1.py"
    source_implementation_file_path = "templates/DecisionTreeClassifier/" + implementation_file_name
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
    // Step 2: Apply the ML technique.
    var step_name = "step_2_execute_ml_technique"
    var step_description = "Read the csv datasets and execute the corresponding ML technique in order to obtain predictions and the ML model."
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
        await models.input.create({doc:"The train and test datasets (in .csv format) generated in the previous steps in order to obtain predictions and the ML model.", stepId:step_id});
    } catch(error) {
        error = "Error creating the input for step 2: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.output.create({doc:"The train and test datasets with a new attribute (the predictions) and the ML model in pickle format.", extension:"csv", stepId:step_id});
    } catch(error) {
        error = "Error creating the output for step 2: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    implementation_file_name = "step2.py"
    source_implementation_file_path = "templates/DecisionTreeClassifier/" + implementation_file_name
    dest_implementation_file_path = implementation_files_folder_path + "/" + implementation_file_name
    try{
        source_file_content = await fs.readFile(source_implementation_file_path, "utf8")
        regex = /<CLASS_NAME>|<RANDOM_STATE>|/g
        new_source_file_content = source_file_content.replaceAll(regex, (match) => {
            if (match === "<CLASS_NAME>") {
                if (
                    ((req.body.class_name.charAt(0) === "\"") && (req.body.class_name.charAt(req.body.class_name.length-1) === "\"")) ||
                    ((req.body.class_name.charAt(0) === "\'") && (req.body.class_name.charAt(req.body.class_name.length-1) === "\""))
                ) {
                    return req.body.class_name;
                } else {
                    return "\"" + req.body.class_name + "\"";
                }
            } else if (match === "<RANDOM_STATE>") {
                return req_body_random_state
            } else {
                return match;
            }
        });
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
    // Step 3: OUTPUT STEP: write the datasets with predictions and the model in pickle format.
    var step_name = "step_3_output"
    var step_description = "Write the train and test datasets with predictions (in csv format) and the model in pickle format."
    var step_type = "output"
    try {
        var step = await models.step.create({name:step_name, doc:step_description, type:step_type, workflowId:workflow_id, position:3});
        var step_id = step.id
    } catch(error) {
        error = "Error creating step 3: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.input.create({doc:"The train and test datasets with predictions (in csv format) and the model in pickle format.", stepId:step_id});
    } catch(error) {
        error = "Error creating the input for step 3: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await models.output.create({doc:"The train and test datasets with predictions (in csv format) and the model in pickle format.", extension:"csv", stepId:step_id});
    } catch(error) {
        error = "Error creating the output for step 3: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    implementation_file_name = "step3.py"
    source_implementation_file_path = "templates/DecisionTreeClassifier/" + implementation_file_name
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
    await WorkflowUtils.workflowComplete(workflow_id);
    return res.sendStatus(200);
});

/**
 * @swagger
 * /phenoflow/DecisionTreeClassifier/uploadCsvDataset:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Upload a dataset (in .csv format).
 *     description: Upload a dataset (in csv format) to be used by the current ML-based phenotype
 *     parameters:
 *       - in: formData
 *         name: phenotypeName
 *         type: string
 *         required: true
 *         description: Name of the phenotype which will use the uploaded dataset
 *       - in: formData
 *         name: uploadedCsvDataset
 *         type: file
 *         required: true
 *         description: Uploaded dataset
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
    // Check whether the Decision Tree Classifier phenotype exists.
    // IMPORTANT: in this point, either no workflow of this type exists or only one exists.
    // - Other workflows with the same name could exist, but they do not correspond to the Decision Tree Classifier technique (i.e., they were created using other endpoints).
    //   ==> This case should not occur (USERS MUST NOT USE HERE A PHENOTYPE THAT IS NOT OF DECISION TREE CLASSIFIER TYPE) and, therefore, it is not handled.
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
 * /phenoflow/DecisionTreeClassifier/generate/{workflowName}/{trainDatasetName}/{testDatasetName}:
 *   get:
 *     summary: Generate a Decision Tree Classifier phenotype
 *     description: Generate a phenotype based on the Decision Tree Classifier technique, indicanting and existing workflow/phenotype name and an existing train and test dataset names (including the extension)
 *     parameters:
 *       - in: path
 *         name: workflowName
 *         type: string
 *         required: true
 *         description: Name of the existing Decision Tree Classifier phenotype
 *       - in: path
 *         name: trainDatasetName
 *         type: string
 *         required: true
 *         description: Name of the existing train dataset (including its extension)
 *       - in: path
 *         name: testDatasetName
 *         type: string
 *         required: true
 *         description: Name of the existing test dataset (including its extension)
 *     responses:
 *       200:
 *         description: Phenotype generated
 *       500:
 *         description: Some error occurred
 */
router.get("/generate/:workflowName/:trainDatasetName/:testDatasetName", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
    if ( !req.params.workflowName || !req.params.trainDatasetName || !req.params.testDatasetName ) {
        return res.status(500).send("Missing parameters (see documentation).")
    }
    // Check whether a workflow defined by the value of 'workflowName' exists.
    // IMPORTANT: since it is a ML-based phenotype, in this point, either no workflow exists or only one exists.
    // - Other workflows with the same name could exist, but they do not correspond to the current ML technique (i.e., they were created using other endpoints).
    //   ==> This case should not occur and, therefore, it is not handled.
    //   ==> USERS MUST NOT USE HERE A PHENOTYPE THAT IS NOT OF DECISION TREE CLASSIFIER TYPE.
    try { 
        var workflow = await models.workflow.findOne({where:{name:req.params.workflowName}});
        var workflow_id = workflow.id;
    } catch(error) {
        error = "Error: workflow with name '" + req.params.workflowName + "' does not exist: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Check whether the train dataset exists.
    dataset_uploads_folder_path = "uploads/" + workflow_id + "/datasets/"
    train_dataset_path = dataset_uploads_folder_path + req.params.trainDatasetName
    try {
        await fs.stat(train_dataset_path);
    } catch(error) {
        error = "Error: dataset with name '" + req.params.trainDatasetName + "' does not exist in '" + dataset_uploads_folder_path + "' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Check whether the test dataset exists.
    dataset_uploads_folder_path = "uploads/" + workflow_id + "/datasets/"
    test_dataset_path = dataset_uploads_folder_path + req.params.testDatasetName
    try {
        await fs.stat(test_dataset_path);
    } catch(error) {
        error = "Error: dataset with name '" + req.params.testDatasetName + "' does not exist in '" + dataset_uploads_folder_path + "' folder: " + error;
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
    templates_folder_path = "templates/DecisionTreeClassifier/"
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
    } catch(error) {
        error = "Error copying python files: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Copy the datasets from uploads folder.
    try {
        // IMPORTANT: 'files' folder will contain all files needed and generated in all steps.
        await fs.mkdir(final_output_path + "files");
    } catch(error) {
        error = "Error creating 'files' folder: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await fs.copyFile(train_dataset_path, final_output_path + 'files/' + req.params.trainDatasetName)
    } catch(error) {
        error = "Error copying the train dataset: " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    try {
        await fs.copyFile(test_dataset_path, final_output_path + 'files/' + req.params.testDatasetName)
    } catch(error) {
        error = "Error copying the test dataset: " + error;
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
        generator_url = config.get("generator.URL") + "/DecisionTreeClassifier/getStepCwl/1"
        step1_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'cwl/step1.cwl', step1_cwl_file_content, "utf8");
        generator_url = config.get("generator.URL") + "/DecisionTreeClassifier/getStepCwl/2"
        step2_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'cwl/step2.cwl', step2_cwl_file_content, "utf8");
        generator_url = config.get("generator.URL") + "/DecisionTreeClassifier/getStepCwl/3"
        step3_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'cwl/step3.cwl', step3_cwl_file_content, "utf8");
        generator_url = config.get("generator.URL") + "/DecisionTreeClassifier/getStepCwl/4"
    } catch(error) {
        error = "Error generating the cwl files corresponding to the steps (" + generator_url + "): " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Call generator endpoint to generate main.cwl file.
    try {
        generator_url = config.get("generator.URL") + "/DecisionTreeClassifier/getMainCwl"
        main_cwl_file_content = await got.get(generator_url).text();
        await fs.writeFile(final_output_path + 'main.cwl', main_cwl_file_content, "utf8");
    } catch(error) {
        error = "Error generating main.cwl file (" + generator_url + "): " + error;
        logger.debug(error);
        return res.status(500).send(error);
    }
    // Call generator endpoint to generate main.yml file.
    try {
        generator_url = config.get("generator.URL") + "/DecisionTreeClassifier/generateMainYml/" + req.params.trainDatasetName + "/" + req.params.testDatasetName
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

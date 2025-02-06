from starlette.applications import Starlette
from starlette.responses import Response, JSONResponse, PlainTextResponse
from api import workflow
import oyaml as yaml
import cwlgen

app = Starlette(debug=True)

def generateWorkflow(steps, nested=False):

  generatedWorkflow = workflow.initWorkflow();
  generatedWorkflowInputs = {};
  generatedSteps = [];

  if (not 'external' in steps[0]['type']): generatedWorkflowInputs['potentialCases'] = {'class':'File', 'path':'replaceMe.csv'};

  for step in steps:
      
    if('language' in step['implementation']): 
      # Send extension of last step output to signify workflow output
      extension = None;
      language = step['implementation']['language'];

      if(step==steps[len(steps) - 1]): extension = step['outputs'][0]['extension'];

      generatedWorkflow = workflow.createWorkflowStep(generatedWorkflow, step['position'], step['name'], step['type'], language, extension, nested);
      generatedWorkflowInputs['inputModule' + str(step['position'])] = {'class':'File', 'path':language + '/' + step['implementation']['fileName']};

      # ~MDC For now, we only assume one variable input to each step, the potential cases; and one variable output, the filtered potential cases.
      if(language=='python'):
        generatedStep = workflow.createPythonStep(step['name'], step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string()
      elif(language=='knime'):
        generatedStep = workflow.createKNIMEStep(step['name'], step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string();
      elif(language=='js'):
        generatedStep = workflow.createJSStep(step['name'], step['type'], step['doc'], step['inputs'][0]['doc'], step['outputs'][0]['extension'], step['outputs'][0]['doc']).export_string();
      else:
        # Handle unknown language
        generatedStep = '';

      generatedSteps.append({'name':step['name'], 'type':step['type'], 'workflowId':step['workflowId'], 'content':generatedStep, 'fileName':step['implementation']['fileName']});
    
    else:
      nestedWorkflow = generateWorkflow(step['implementation']['steps'], True);
      # Update parent workflow to accomodate nested implementation units
      nestedWorkflowInputs = nestedWorkflow['workflowInputs'];
      nestedWorkflowInputModules = [nestedWorkflowInput for nestedWorkflowInput in nestedWorkflowInputs if 'inputModule' in nestedWorkflowInput];
      for workflowInput in nestedWorkflowInputModules: generatedWorkflowInputs['inputModule'+str(step['position'])+'-'+str(list(nestedWorkflowInputModules).index(workflowInput)+1)] = {'class':'File', 'path':nestedWorkflowInputs[workflowInput]['path']};
      generatedWorkflow = workflow.createNestedWorkflowStep(generatedWorkflow, step['position'], step['name'], nestedWorkflow);

      # If sent a nested workflow to generate, generate this and store it as a step (as opposed to a command line tool)
      generatedSteps.append({'name':step['name'], 'type':step['type'], 'workflowId':step['workflowId'], 'content':yaml.dump(nestedWorkflow['workflow'], default_flow_style=False), 'steps':nestedWorkflow['steps']});
  
  return {'workflow':generatedWorkflow.get_dict(), 'steps':generatedSteps, 'workflowInputs':generatedWorkflowInputs}

@app.route('/generate', methods=['POST'])
async def generate(request):
  try:
    steps = await request.json();
  except:
    steps = None;

  if(steps): 
    generatedWorkflow = generateWorkflow(steps);
    return JSONResponse({'workflow': yaml.dump(generatedWorkflow['workflow'], default_flow_style=False), 'steps': generatedWorkflow['steps'], 'workflowInputs': yaml.dump(generatedWorkflow['workflowInputs'], default_flow_style=False)});
  else:
    return JSONResponse({});

#############################################################################
#############################################################################
################ ROUTES FOR TRACE-BASED CLUSTERING TECHNIQUE ################
#############################################################################
#############################################################################

@app.route('/tbc/getStepCwl/{step_number:int}', methods=['GET'])
async def tbcGetStepCwl(request):
  # step_number must be between 1 and 5 (both included).
  step_number_param = request.path_params['step_number']
  if (step_number_param < 1) or (step_number_param > 5):
    return Response("ERROR: 'step_number' parameter must be an integer between 1 and 5 (both included).", status_code = 500)
  try:
    # CommandLineTool
    step = cwlgen.CommandLineTool(
                  tool_id='step' + str(step_number_param),
                  base_command='python',
                  label="step" + str(step_number_param),
                  doc="CWL file to run automatically step" + str(step_number_param),
                  cwl_version="v1.0"
                  )
    # namespaces
    step_namespace = cwlgen.Namespaces()
    step_namespace.name = "$namespaces"
    step_namespace.s = "http://phenomics.kcl.ac.uk/phenoflow/"
    step.namespaces = step_namespace
    # requirements
    # - IMPORTANT: it must be a list.
    step.requirements = [ cwlgen.DockerRequirement(docker_pull="kclhi/regression:latest") ]
    # metadata
    if (step_number_param == 1):
      metadata = {'type' : 'load'}
    elif ((step_number_param > 1) and (step_number_param < 5)): # between 1 and 5 (both NOT included).
      metadata = {'type' : 'logic'}
    elif (step_number_param == 5):
      metadata = {'type' : 'output'}
    else:
      # We checked at the beginning that 'step_number_param' parameter is ok. This should never happen.
      return Response("CRITICAL ERROR (metadata): this should never happen.", status_code = 500)
    step.metadata = cwlgen.Metadata(**metadata)
    # inputs
    step_python_file = cwlgen.CommandInputParameter(
                              param_id='step' + str(step_number_param) + '_python_file',
                              label='step' + str(step_number_param) + '_python_file',
                              param_type='File',
                              input_binding=cwlgen.CommandLineBinding(position=1),
                              doc='Python file corresponding to step' + str(step_number_param)
                              )
    if (step_number_param == 1):
      step_second_input_param_id_label = "step1_input_dataset" # In this case, "param_id" and "label" have the same value.
      step_second_input_doc = "File that contains the input dataset"
    elif (step_number_param == 2):
      step_second_input_param_id_label = "step2_input_dataset" # In this case, "param_id" and "label" have the same value.
      step_second_input_doc = "File that contains the dataset"
    elif (step_number_param == 3):
      step_second_input_param_id_label = "step3_input_partitions" # In this case, "param_id" and "label" have the same value.
      step_second_input_doc = "File that contains the partitions in JSON format"
    elif (step_number_param == 4):
      step_second_input_param_id_label = "step4_input_matrix_of_matches" # In this case, "param_id" and "label" have the same value.
      step_second_input_doc = "File that contains the matrix of matches in JSON format"
    elif (step_number_param == 5):
      step_second_input_param_id_label = "step5_input_final_candidate_clusters" # In this case, "param_id" and "label" have the same value.
      step_second_input_doc = "File that contains the final candidate clusters in JSON format"
    else:
      # We checked at the beginning that 'step_number_param' parameter is ok. This should never happen.
      return Response("CRITICAL ERROR (step_second_input): this should never happen.", status_code = 500)
    step_second_input = cwlgen.CommandInputParameter(
                              param_id=step_second_input_param_id_label,
                              label=step_second_input_param_id_label,
                              param_type='File',
                              input_binding=cwlgen.CommandLineBinding(position=2),
                              doc=step_second_input_doc
                              )
    step.inputs.append(step_python_file)
    step.inputs.append(step_second_input)
    # outputs
    if (step_number_param == 1):
      step_output_param_id_label = "step1_output_dataset" # In this case, "param_id" and "label" have the same value.
      step_output_doc = "Dataset generated after executing step1"
      step_output_glob = "*.csv"
    elif (step_number_param == 2):
      step_output_param_id_label = "step2_output_partitions" # In this case, "param_id" and "label" have the same value.
      step_output_doc = "Partitions in JSON format generated after executing step2"
      step_output_glob = "partitions.json"
    elif (step_number_param == 3):
      step_output_param_id_label = "step3_output_matrix_of_matches" # In this case, "param_id" and "label" have the same value.
      step_output_doc = "Matrix of matches in JSON format generated after executing step3"
      step_output_glob = "matrix_of_matches.json"
    elif (step_number_param == 4):
      step_output_param_id_label = "step4_output_final_candidate_clusters" # In this case, "param_id" and "label" have the same value.
      step_output_doc = "Final candidate clusters in JSON format generated after executing step4"
      step_output_glob = "final_candidate_clusters.json"
    elif (step_number_param == 5):
      step_output_param_id_label = "step5_output_final_candidate_clusters" # In this case, "param_id" and "label" have the same value.
      step_output_doc = "Final candidate clusters in CSV format generated after executing step5"
      step_output_glob = "*.csv"
    else:
      # We checked at the beginning that 'step_number_param' parameter is ok. This should never happen.
      return Response("CRITICAL ERROR (step_output): this should never happen.", status_code = 500)
    step_output = cwlgen.CommandOutputParameter(
                                param_id=step_output_param_id_label,
                                label=step_output_param_id_label,
                                param_type='File',
                                output_binding=cwlgen.CommandOutputBinding(glob=step_output_glob),
                                doc=step_output_doc
                                )
    step.outputs.append(step_output)
    return PlainTextResponse(step.export_string())
  except Exception as e:
    return Response("ERROR generating step" + str(step_number_param) + ".cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getMainCwl', methods=['GET'])
async def tbcGetMainCwl(request):
  try:
    # Workflow
    tbc_workflow = cwlgen.workflow.Workflow(
                      workflow_id="tbc_workflow",
                      label="tbc_workflow",
                      doc="Main workflow for the Trace-based clustering technique",
                      cwl_version="v1.0"
                      )
    # requirements
    # - IMPORTANT: it must be a list.
    tbc_workflow.requirements = [ cwlgen.SubworkflowFeatureRequirement() ]
    # steps
    step1 = cwlgen.workflow.WorkflowStep(
                        step_id="step1",
                        run="cwl/step1.cwl"                    
                        )
    step1.inputs.append( cwlgen.WorkflowStepInput(input_id="step1_python_file", source="step1_python_file") )
    step1.inputs.append( cwlgen.WorkflowStepInput(input_id="step1_input_dataset", source="step1_input_dataset") )
    step1.out.append( cwlgen.WorkflowStepOutput(output_id="step1_output_dataset") )
    tbc_workflow.steps.append( step1 )
    step2 = cwlgen.workflow.WorkflowStep(
                        step_id="step2",
                        run="cwl/step2.cwl"                    
                        )
    step2.inputs.append( cwlgen.WorkflowStepInput(input_id="step2_python_file", source="step2_python_file") )
    step2.inputs.append( cwlgen.WorkflowStepInput(input_id="step2_input_dataset", source="step1/step1_output_dataset") )
    step2.out.append( cwlgen.WorkflowStepOutput(output_id="step2_output_partitions") )
    tbc_workflow.steps.append( step2 )
    step3 = cwlgen.workflow.WorkflowStep(
                        step_id="step3",
                        run="cwl/step3.cwl"                    
                        )
    step3.inputs.append( cwlgen.WorkflowStepInput(input_id="step3_python_file", source="step3_python_file") )
    step3.inputs.append( cwlgen.WorkflowStepInput(input_id="step3_input_partitions", source="step2/step2_output_partitions") )
    step3.out.append( cwlgen.WorkflowStepOutput(output_id="step3_output_matrix_of_matches") )
    tbc_workflow.steps.append( step3 )
    step4 = cwlgen.workflow.WorkflowStep(
                        step_id="step4",
                        run="cwl/step4.cwl"                    
                        )
    step4.inputs.append( cwlgen.WorkflowStepInput(input_id="step4_python_file", source="step4_python_file") )
    step4.inputs.append( cwlgen.WorkflowStepInput(input_id="step4_input_matrix_of_matches", source="step3/step3_output_matrix_of_matches") )
    step4.out.append( cwlgen.WorkflowStepOutput(output_id="step4_output_final_candidate_clusters") )
    tbc_workflow.steps.append( step4 )
    step5 = cwlgen.workflow.WorkflowStep(
                        step_id="step5",
                        run="cwl/step5.cwl"                    
                        )
    step5.inputs.append( cwlgen.WorkflowStepInput(input_id="step5_python_file", source="step5_python_file") )
    step5.inputs.append( cwlgen.WorkflowStepInput(input_id="step5_input_final_candidate_clusters", source="step4/step4_output_final_candidate_clusters") )
    step5.out.append( cwlgen.WorkflowStepOutput(output_id="step5_output_final_candidate_clusters") )
    tbc_workflow.steps.append( step5 )
    # inputs
    workflow_input_step1_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step1_python_file",
                                        label="step1_python_file",
                                        doc="Python file corresponding to step1",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step1_python_file )
    workflow_input_step1_input_dataset = cwlgen.workflow.InputParameter(
                                        param_id="step1_input_dataset",
                                        label="step1_input_dataset",
                                        doc="File that contains the input dataset",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step1_input_dataset )
    workflow_input_step2_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step2_python_file",
                                        label="step2_python_file",
                                        doc="Python file corresponding to step2",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step2_python_file )
    workflow_input_step3_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step3_python_file",
                                        label="step3_python_file",
                                        doc="Python file corresponding to step3",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step3_python_file )
    workflow_input_step4_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step4_python_file",
                                        label="step4_python_file",
                                        doc="Python file corresponding to step4",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step4_python_file )
    workflow_input_step5_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step5_python_file",
                                        label="step5_python_file",
                                        doc="Python file corresponding to step5",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step5_python_file )
    # outputs
    workflow_output = cwlgen.workflow.WorkflowOutputParameter(
                                param_id="step5_output_final_candidate_clusters",
                                output_source="step5/step5_output_final_candidate_clusters",
                                label="step5_output_final_candidate_clusters",
                                doc="Final candidate clusters in CSV format generated after executing step5",
                                param_type="File"
                                )
    tbc_workflow.outputs.append(workflow_output)
    return PlainTextResponse(tbc_workflow.export_string())
  except Exception as e: # Any exception.
    return Response("ERROR generating main.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/generateMainYml/{dataset_name:str}', methods=['GET'])
async def tbcGenerateMainYml(request):
  try:
    main_yml_file_content = "step1_python_file:\n  class: File\n  path: python/step1.py\n"
    main_yml_file_content = main_yml_file_content + "step1_input_dataset:\n  class: File\n  path: files/" + request.path_params['dataset_name'] + "\n"
    main_yml_file_content = main_yml_file_content + "step2_python_file:\n  class: File\n  path: python/step2.py\n"
    main_yml_file_content = main_yml_file_content + "step3_python_file:\n  class: File\n  path: python/step3.py\n"
    main_yml_file_content = main_yml_file_content + "step4_python_file:\n  class: File\n  path: python/step4.py\n"
    main_yml_file_content = main_yml_file_content + "step5_python_file:\n  class: File\n  path: python/step5.py\n"
    return PlainTextResponse(main_yml_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR generating main.yml file: " + str(e), status_code = 500)

###########################################################################
###########################################################################
################ ROUTES FOR LOGISTIC REGRESSION TECHNIQUE ################
###########################################################################
###########################################################################

@app.route('/LogisticRegression/getMainCwl', methods=['GET'])
async def LogisticRegressionGetMainCwl(request):
  try:
    # Workflow
    workflow_object = cwlgen.workflow.Workflow(
                      workflow_id="LogisticRegression_workflow",
                      label="LogisticRegression_workflow",
                      doc="Main workflow for the Logistic Regression technique",
                      cwl_version="v1.0"
                      )
    # requirements
    # - IMPORTANT: it must be a list.
    workflow_object.requirements = [ cwlgen.SubworkflowFeatureRequirement() ]
    # steps
    step1 = cwlgen.workflow.WorkflowStep(
                        step_id="step1",
                        run="cwl/step1.cwl"
                        )
    step1.inputs.append( cwlgen.WorkflowStepInput(input_id="step1_python_file", source="step1_python_file") )
    step1.inputs.append( cwlgen.WorkflowStepInput(input_id="step1_input_train_dataset", source="step1_input_train_dataset") )
    step1.inputs.append( cwlgen.WorkflowStepInput(input_id="step1_input_test_dataset", source="step1_input_test_dataset") )
    step1.out.append( cwlgen.WorkflowStepOutput(output_id="step1_output_train_dataset") )
    step1.out.append( cwlgen.WorkflowStepOutput(output_id="step1_output_test_dataset") )
    workflow_object.steps.append( step1 )
    step2 = cwlgen.workflow.WorkflowStep(
                        step_id="step2",
                        run="cwl/step2.cwl"
                        )
    step2.inputs.append( cwlgen.WorkflowStepInput(input_id="step2_python_file", source="step2_python_file") )
    step2.inputs.append( cwlgen.WorkflowStepInput(input_id="step2_input_train_dataset", source="step1/step1_output_train_dataset") )
    step2.inputs.append( cwlgen.WorkflowStepInput(input_id="step2_input_test_dataset", source="step1/step1_output_test_dataset") )
    step2.out.append( cwlgen.WorkflowStepOutput(output_id="step2_output_train_dataset_with_predictions") )
    step2.out.append( cwlgen.WorkflowStepOutput(output_id="step2_output_test_dataset_with_predictions") )
    step2.out.append( cwlgen.WorkflowStepOutput(output_id="step2_output_pickel_model") )
    workflow_object.steps.append( step2 )
    step3 = cwlgen.workflow.WorkflowStep(
                        step_id="step3",
                        run="cwl/step3.cwl"
                        )
    step3.inputs.append( cwlgen.WorkflowStepInput(input_id="step3_python_file", source="step3_python_file") )
    step3.inputs.append( cwlgen.WorkflowStepInput(input_id="step3_input_train_dataset_with_predictions", source="step2/step2_output_train_dataset_with_predictions") )
    step3.inputs.append( cwlgen.WorkflowStepInput(input_id="step3_input_test_dataset_with_predictions", source="step2/step2_output_test_dataset_with_predictions") )
    step3.inputs.append( cwlgen.WorkflowStepInput(input_id="step3_input_pickle_model", source="step2/step2_output_pickel_model") )
    step3.out.append( cwlgen.WorkflowStepOutput(output_id="step3_output_train_dataset_with_predictions") )
    step3.out.append( cwlgen.WorkflowStepOutput(output_id="step3_output_test_dataset_with_predictions") )
    step3.out.append( cwlgen.WorkflowStepOutput(output_id="step3_output_pickle_model") )
    workflow_object.steps.append( step3 )
    # inputs
    workflow_input_step1_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step1_python_file",
                                        label="step1_python_file",
                                        doc="Python file corresponding to the step 1",
                                        param_type="File"
                                        )
    workflow_object.inputs.append( workflow_input_step1_python_file )
    workflow_input_step1_input_train_dataset = cwlgen.workflow.InputParameter(
                                        param_id="step1_input_train_dataset",
                                        label="step1_input_train_dataset",
                                        doc="Train dataset corresponding to the step 1",
                                        param_type="File"
                                        )
    workflow_object.inputs.append( workflow_input_step1_input_train_dataset )
    workflow_input_step1_input_test_dataset = cwlgen.workflow.InputParameter(
                                        param_id="step1_input_test_dataset",
                                        label="step1_input_test_dataset",
                                        doc="Test dataset corresponding to the step 1",
                                        param_type="File"
                                        )
    workflow_object.inputs.append( workflow_input_step1_input_test_dataset )
    workflow_input_step2_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step2_python_file",
                                        label="step2_python_file",
                                        doc="Python file corresponding to the step 2",
                                        param_type="File"
                                        )
    workflow_object.inputs.append( workflow_input_step2_python_file )
    workflow_input_step3_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step3_python_file",
                                        label="step3_python_file",
                                        doc="Python file corresponding to the step 3",
                                        param_type="File"
                                        )
    workflow_object.inputs.append( workflow_input_step3_python_file )
    # outputs
    workflow_output = cwlgen.workflow.WorkflowOutputParameter(
                                param_id="step3_output_train_dataset_with_predictions",
                                output_source="step3/step3_output_train_dataset_with_predictions",
                                label="step3_output_train_dataset_with_predictions",
                                doc="Train dataset in CSV format with the final predictions",
                                param_type="File"
                                )
    workflow_object.outputs.append(workflow_output)
    workflow_output = cwlgen.workflow.WorkflowOutputParameter(
                                param_id="step3_output_test_dataset_with_predictions",
                                output_source="step3/step3_output_test_dataset_with_predictions",
                                label="step3_output_test_dataset_with_predictions",
                                doc="Test dataset in CSV format with the final predictions",
                                param_type="File"
                                )
    workflow_object.outputs.append(workflow_output)
    workflow_output = cwlgen.workflow.WorkflowOutputParameter(
                                param_id="step3_output_pickle_model",
                                output_source="step3/step3_output_pickle_model",
                                label="step3_output_pickle_model",
                                doc="Model in pickle format",
                                param_type="File"
                                )
    workflow_object.outputs.append(workflow_output)
    return PlainTextResponse(workflow_object.export_string())
  except Exception as e: # Any exception.
    return Response("ERROR generating main.cwl file: " + str(e), status_code = 500)

@app.route('/LogisticRegression/generateMainYml/{train_dataset_name:str}/{test_dataset_name:str}', methods=['GET'])
async def LogisticRegressionGenerateMainYml(request):
  try:
    main_yml_file_content = "step1_python_file:\n  class: File\n  path: python/step1.py\n"
    main_yml_file_content = main_yml_file_content + "step1_input_train_dataset:\n  class: File\n  path: files/" + request.path_params['train_dataset_name'] + "\n"
    main_yml_file_content = main_yml_file_content + "step1_input_test_dataset:\n  class: File\n  path: files/" + request.path_params['test_dataset_name'] + "\n"
    main_yml_file_content = main_yml_file_content + "step2_python_file:\n  class: File\n  path: python/step2.py\n"
    main_yml_file_content = main_yml_file_content + "step3_python_file:\n  class: File\n  path: python/step3.py\n"
    return PlainTextResponse(main_yml_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR generating main.yml file: " + str(e), status_code = 500)

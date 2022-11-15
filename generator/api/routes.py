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

@app.route('/tbc/getStep1Cwl', methods=['GET'])
async def tbcGetStep1Cwl(request):
  try:
    # CommandLineTool
    step1 = cwlgen.CommandLineTool(
                tool_id='step1',
                base_command='python',
                label="step1",
                doc="CWL file to run automatically the step 1",
                cwl_version="v1.0"
                )
    # namespaces
    step1_namespace = cwlgen.Namespaces()
    step1_namespace.name = "$namespaces"
    step1_namespace.s = "http://phenomics.kcl.ac.uk/phenoflow/"
    step1.namespaces = step1_namespace
    # requirements
    # - IMPORTANT: it must be a list.
    step1.requirements = [ cwlgen.DockerRequirement(docker_pull="kclhi/regression:latest") ]
    # metadata
    metadata = {'type' : 'load'}
    step1.metadata = cwlgen.Metadata(**metadata)
    # inputs
    step1_python_file = cwlgen.CommandInputParameter(
                            param_id='step1_python_file',
                            label='step1_python_file',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=1),
                            doc='Python file corresponding to the step 1'
                            )
    step1_input_dataset = cwlgen.CommandInputParameter(
                            param_id='step1_input_dataset',
                            label='step1_input_dataset',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=2),
                            doc='File that contains the input dataset'
                            )
    step1.inputs.append(step1_python_file)
    step1.inputs.append(step1_input_dataset)
    # outputs
    step1_output_dataset = cwlgen.CommandOutputParameter(
                                          param_id='step1_output_dataset',
                                          label='step1_output_dataset',
                                          param_type='File',
                                          output_binding=cwlgen.CommandOutputBinding(glob="*.csv"),
                                          doc='Dataset generated after executing the step 1'
                                          )
    step1.outputs.append(step1_output_dataset)
    return PlainTextResponse(step1.export_string())
  except Exception as e: # Any exception.
    return Response("ERROR generating step1.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getStep2Cwl', methods=['GET'])
async def tbcGetStep2Cwl(request):
  try:
    # CommandLineTool
    step2 = cwlgen.CommandLineTool(
                tool_id='step2',
                base_command='python',
                label="step2",
                doc="CWL file to run automatically the step 2",
                cwl_version="v1.0"
                )
    # namespaces
    step2_namespace = cwlgen.Namespaces()
    step2_namespace.name = "$namespaces"
    step2_namespace.s = "http://phenomics.kcl.ac.uk/phenoflow/"
    step2.namespaces = step2_namespace
    # requirements
    # - IMPORTANT: it must be a list.
    step2.requirements = [ cwlgen.DockerRequirement(docker_pull="kclhi/regression:latest") ]
    # metadata
    metadata = {'type' : 'logic'}
    step2.metadata = cwlgen.Metadata(**metadata)
    # inputs
    step2_python_file = cwlgen.CommandInputParameter(
                            param_id='step2_python_file',
                            label='step2_python_file',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=1),
                            doc='Python file corresponding to the step 2'
                            )
    step2_input_dataset = cwlgen.CommandInputParameter(
                            param_id='step2_input_dataset',
                            label='step2_input_dataset',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=2),
                            doc='File that contains the dataset'
                            )
    step2.inputs.append(step2_python_file)
    step2.inputs.append(step2_input_dataset)
    # outputs
    step2_output_partitions = cwlgen.CommandOutputParameter(
                                          param_id='step2_output_partitions',
                                          label='step2_output_partitions',
                                          param_type='File',
                                          output_binding=cwlgen.CommandOutputBinding(glob="partitions.json"),
                                          doc='Partitions in JSON format generated after executing the step 2'
                                          )
    step2.outputs.append(step2_output_partitions)
    return PlainTextResponse(step2.export_string())
  except Exception as e: # Any exception.
    return Response("ERROR generating step2.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getStep3Cwl', methods=['GET'])
async def tbcGetStep3Cwl(request):
  try:
    # CommandLineTool
    step3 = cwlgen.CommandLineTool(
                tool_id='step3',
                base_command='python',
                label="step3",
                doc="CWL file to run automatically the step 3",
                cwl_version="v1.0"
                )
    # namespaces
    step3_namespace = cwlgen.Namespaces()
    step3_namespace.name = "$namespaces"
    step3_namespace.s = "http://phenomics.kcl.ac.uk/phenoflow/"
    step3.namespaces = step3_namespace
    # requirements
    # - IMPORTANT: it must be a list.
    step3.requirements = [ cwlgen.DockerRequirement(docker_pull="kclhi/regression:latest") ]
    # metadata
    metadata = {'type' : 'logic'}
    step3.metadata = cwlgen.Metadata(**metadata)
    # inputs
    step3_python_file = cwlgen.CommandInputParameter(
                            param_id='step3_python_file',
                            label='step3_python_file',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=1),
                            doc='Python file corresponding to the step 3'
                            )
    step3_input_partitions = cwlgen.CommandInputParameter(
                            param_id='step3_input_partitions',
                            label='step3_input_partitions',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=2),
                            doc='File that contains the partitions in JSON format'
                            )
    step3.inputs.append(step3_python_file)
    step3.inputs.append(step3_input_partitions)
    # outputs
    step3_output_matrix_of_matches = cwlgen.CommandOutputParameter(
                                          param_id='step3_output_matrix_of_matches',
                                          label='step3_output_matrix_of_matches',
                                          param_type='File',
                                          output_binding=cwlgen.CommandOutputBinding(glob="matrix_of_matches.json"),
                                          doc='Matrix of matches in JSON format generated after executing the step 3'
                                          )
    step3.outputs.append(step3_output_matrix_of_matches)
    return PlainTextResponse(step3.export_string())
  except Exception as e: # Any exception.
    return Response("ERROR generating step3.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getStep4Cwl', methods=['GET'])
async def tbcGetStep4Cwl(request):
  try:
    # CommandLineTool
    step4 = cwlgen.CommandLineTool(
                tool_id='step4',
                base_command='python',
                label="step4",
                doc="CWL file to run automatically the step 4",
                cwl_version="v1.0"
                )
    # namespaces
    step4_namespace = cwlgen.Namespaces()
    step4_namespace.name = "$namespaces"
    step4_namespace.s = "http://phenomics.kcl.ac.uk/phenoflow/"
    step4.namespaces = step4_namespace
    # requirements
    # - IMPORTANT: it must be a list.
    step4.requirements = [ cwlgen.DockerRequirement(docker_pull="kclhi/regression:latest") ]
    # metadata
    metadata = {'type' : 'logic'}
    step4.metadata = cwlgen.Metadata(**metadata)
    # inputs
    step4_python_file = cwlgen.CommandInputParameter(
                            param_id='step4_python_file',
                            label='step4_python_file',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=1),
                            doc='Python file corresponding to the step 4'
                            )
    step4_input_matrix_of_matches = cwlgen.CommandInputParameter(
                            param_id='step4_input_matrix_of_matches',
                            label='step4_input_matrix_of_matches',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=2),
                            doc='File that contains the matrix of matches in JSON format'
                            )
    step4.inputs.append(step4_python_file)
    step4.inputs.append(step4_input_matrix_of_matches)
    # outputs
    step4_output_final_candidate_clusters = cwlgen.CommandOutputParameter(
                                          param_id='step4_output_final_candidate_clusters',
                                          label='step4_output_final_candidate_clusters',
                                          param_type='File',
                                          output_binding=cwlgen.CommandOutputBinding(glob="final_candidate_clusters.json"),
                                          doc='Final candidate clusters in JSON format generated after executing the step 4'
                                          )
    step4.outputs.append(step4_output_final_candidate_clusters)
    return PlainTextResponse(step4.export_string())
  except Exception as e: # Any exception.
    return Response("ERROR generating step4.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getStep5Cwl', methods=['GET'])
async def tbcGetStep5Cwl(request):
  try:
    # CommandLineTool
    step5 = cwlgen.CommandLineTool(
                tool_id='step5',
                base_command='python',
                label="step5",
                doc="CWL file to run automatically the step 5",
                cwl_version="v1.0"
                )
    # namespaces
    step5_namespace = cwlgen.Namespaces()
    step5_namespace.name = "$namespaces"
    step5_namespace.s = "http://phenomics.kcl.ac.uk/phenoflow/"
    step5.namespaces = step5_namespace
    # requirements
    # - IMPORTANT: it must be a list.
    step5.requirements = [ cwlgen.DockerRequirement(docker_pull="kclhi/regression:latest") ]
    # metadata
    metadata = {'type' : 'output'}
    step5.metadata = cwlgen.Metadata(**metadata)
    # inputs
    step5_python_file = cwlgen.CommandInputParameter(
                            param_id='step5_python_file',
                            label='step5_python_file',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=1),
                            doc='Python file corresponding to the step 5'
                            )
    step5_input_final_candidate_clusters = cwlgen.CommandInputParameter(
                            param_id='step5_input_final_candidate_clusters',
                            label='step5_input_final_candidate_clusters',
                            param_type='File',
                            input_binding=cwlgen.CommandLineBinding(position=2),
                            doc='File that contains the final candidate clusters in JSON format'
                            )
    step5.inputs.append(step5_python_file)
    step5.inputs.append(step5_input_final_candidate_clusters)
    # outputs
    step5_output_final_candidate_clusters = cwlgen.CommandOutputParameter(
                                          param_id='step5_output_final_candidate_clusters',
                                          label='step5_output_final_candidate_clusters',
                                          param_type='File',
                                          output_binding=cwlgen.CommandOutputBinding(glob="*.csv"),
                                          doc='Final candidate clusters in CSV format generated after executing the step 5'
                                          )
    step5.outputs.append(step5_output_final_candidate_clusters)
    return PlainTextResponse(step5.export_string())
  except Exception as e: # Any exception.
    return Response("ERROR generating step5.cwl file: " + str(e), status_code = 500)

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
                                        doc="Python file corresponding to the step 1",
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
                                        doc="Python file corresponding to the step 2",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step2_python_file )
    workflow_input_step3_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step3_python_file",
                                        label="step3_python_file",
                                        doc="Python file corresponding to the step 3",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step3_python_file )
    workflow_input_step4_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step4_python_file",
                                        label="step4_python_file",
                                        doc="Python file corresponding to the step 4",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step4_python_file )
    workflow_input_step5_python_file = cwlgen.workflow.InputParameter(
                                        param_id="step5_python_file",
                                        label="step5_python_file",
                                        doc="Python file corresponding to the step 5",
                                        param_type="File"
                                        )
    tbc_workflow.inputs.append( workflow_input_step5_python_file )
    # outputs
    workflow_output = cwlgen.workflow.WorkflowOutputParameter(
                                param_id="step5_output_final_candidate_clusters",
                                output_source="step5/step5_output_final_candidate_clusters",
                                label="step5_output_final_candidate_clusters",
                                doc="Final candidate clusters in CSV format",
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

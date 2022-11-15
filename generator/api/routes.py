from starlette.applications import Starlette
from starlette.responses import Response, JSONResponse, PlainTextResponse
from api import workflow
import oyaml as yaml

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

##############################################################################
##############################################################################
############################### ROUTES FOR TBC ###############################
##############################################################################
##############################################################################

@app.route('/tbc/getStep1Cwl', methods=['GET'])
async def tbcGetStep1Cwl(request):
  try:
    step1_cwl_file = open("templates/tbc/step1.cwl", "r")
    step1_cwl_file_content = step1_cwl_file.read()
    step1_cwl_file.close()
    return PlainTextResponse(step1_cwl_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR with step1.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getStep2Cwl', methods=['GET'])
async def tbcGetStep2Cwl(request):
  try:
    step2_cwl_file = open("templates/tbc/step2.cwl", "r")
    step2_cwl_file_content = step2_cwl_file.read()
    step2_cwl_file.close()
    return PlainTextResponse(step2_cwl_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR with step2.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getStep3Cwl', methods=['GET'])
async def tbcGetStep3Cwl(request):
  try:
    step3_cwl_file = open("templates/tbc/step3.cwl", "r")
    step3_cwl_file_content = step3_cwl_file.read()
    step3_cwl_file.close()
    return PlainTextResponse(step3_cwl_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR with step3.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getStep4Cwl', methods=['GET'])
async def tbcGetStep4Cwl(request):
  try:
    step4_cwl_file = open("templates/tbc/step4.cwl", "r")
    step4_cwl_file_content = step4_cwl_file.read()
    step4_cwl_file.close()
    return PlainTextResponse(step4_cwl_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR with step4.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getStep5Cwl', methods=['GET'])
async def tbcGetStep5Cwl(request):
  try:
    step5_cwl_file = open("templates/tbc/step5.cwl", "r")
    step5_cwl_file_content = step5_cwl_file.read()
    step5_cwl_file.close()
    return PlainTextResponse(step5_cwl_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR with step5.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/getMainCwl', methods=['GET'])
async def tbcGetMainCwl(request):
  try:
    main_cwl_file = open("templates/tbc/main.cwl", "r")
    main_cwl_file_content = main_cwl_file.read()
    main_cwl_file.close()
    return PlainTextResponse(main_cwl_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR with main.cwl file: " + str(e), status_code = 500)

@app.route('/tbc/generateMainYml/{dataset_name:str}', methods=['GET'])
async def tbcGenerateMainYml(request):
  try:
    main_yml_file = open("templates/tbc/main.yml", "r")
    main_yml_file_content = main_yml_file.read()
    main_yml_file.close()
    main_yml_file_content = main_yml_file_content.replace("<DATASET_NAME>", request.path_params['dataset_name'])
    return PlainTextResponse(main_yml_file_content)
  except Exception as e: # Any exception.
    return Response("ERROR generating main.yml file: " + str(e), status_code = 500)

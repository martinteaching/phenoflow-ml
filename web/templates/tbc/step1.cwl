$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
cwlVersion: v1.2
class: CommandLineTool
id: step1
doc: CWL file to run automatically the step 1
baseCommand: python
inputs:
- doc: Python file corresponding to the step 1
  id: step1_python_file
  type: File
  inputBinding:
    position: 1
- doc: File that contains the input dataset
  id: step1_input_dataset
  type: File
  inputBinding:
    position: 2
outputs:
- doc: Dataset generated after executing the step 1
  id: step1_output_dataset
  type: File
  outputBinding:
    glob: '*.csv'
requirements:
  DockerRequirement:
    dockerPull: kclhi/regression:latest
s:type: load

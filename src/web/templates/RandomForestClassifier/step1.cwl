$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
cwlVersion: v1.2
class: CommandLineTool
id: step1
doc: CWL file to automatically run the step 1
baseCommand: python
inputs:
- doc: Python file corresponding to the step 1
  id: step1_python_file
  type: File
  inputBinding:
    position: 1
- doc: Input train dataset corresponding to the step 1
  id: step1_input_train_dataset
  type: File
  inputBinding:
    position: 2
- doc: Input test dataset corresponding to the step 1
  id: step1_input_test_dataset
  type: File
  inputBinding:
    position: 3
outputs:
- doc: Output train dataset corresponding to the step 1
  id: step1_output_train_dataset
  type: File
  outputBinding:
    glob: '*_train_dataset.csv'
- doc: Output test dataset corresponding to the step 1
  id: step1_output_test_dataset
  type: File
  outputBinding:
    glob: '*_test_dataset.csv'
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: load

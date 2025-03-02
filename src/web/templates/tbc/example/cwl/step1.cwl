$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
baseCommand: python
class: CommandLineTool
cwlVersion: v1.0
doc: CWL file to run automatically step1
id: step1
inputs:
- doc: Python file corresponding to step1
  id: step1_python_file
  inputBinding:
    position: 1
  label: step1_python_file
  type: File
- doc: File that contains the input dataset
  id: step1_input_dataset
  inputBinding:
    position: 2
  label: step1_input_dataset
  type: File
label: step1
outputs:
- doc: Dataset generated after executing step1
  id: step1_output_dataset
  label: step1_output_dataset
  outputBinding:
    glob: '*.csv'
  type: File
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: load

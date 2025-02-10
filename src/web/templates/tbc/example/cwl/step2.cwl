$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
baseCommand: python
class: CommandLineTool
cwlVersion: v1.0
doc: CWL file to run automatically step2
id: step2
inputs:
- doc: Python file corresponding to step2
  id: step2_python_file
  inputBinding:
    position: 1
  label: step2_python_file
  type: File
- doc: File that contains the dataset
  id: step2_input_dataset
  inputBinding:
    position: 2
  label: step2_input_dataset
  type: File
label: step2
outputs:
- doc: Partitions in JSON format generated after executing step2
  id: step2_output_partitions
  label: step2_output_partitions
  outputBinding:
    glob: partitions.json
  type: File
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: logic

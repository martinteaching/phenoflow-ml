$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
cwlVersion: v1.2
class: CommandLineTool
id: step2
doc: CWL file to run automatically the step 2
baseCommand: python
inputs:
- doc: Python file corresponding to the step 2
  id: step2_python_file
  type: File
  inputBinding:
    position: 1
- doc: File that contains the dataset
  id: step2_input_dataset
  type: File
  inputBinding:
    position: 2
outputs:
- doc: Partitions in JSON format generated after executing the step 2
  id: step2_output_partitions
  type: File
  outputBinding:
    glob: 'partitions.json'
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: logic

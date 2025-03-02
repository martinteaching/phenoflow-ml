$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
cwlVersion: v1.2
class: CommandLineTool
id: step3
doc: CWL file to run automatically the step 3
baseCommand: python
inputs:
- doc: Python file corresponding to the step 3
  id: step3_python_file
  type: File
  inputBinding:
    position: 1
- doc: File that contains the partitions in JSON format
  id: step3_input_partitions
  type: File
  inputBinding:
    position: 2
outputs:
- doc: Matrix of matches in JSON format generated after executing the step 3
  id: step3_output_matrix_of_matches
  type: File
  outputBinding:
    glob: 'matrix_of_matches.json'
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: logic

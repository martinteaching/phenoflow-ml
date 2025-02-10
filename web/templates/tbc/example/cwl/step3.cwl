$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
baseCommand: python
class: CommandLineTool
cwlVersion: v1.0
doc: CWL file to run automatically step3
id: step3
inputs:
- doc: Python file corresponding to step3
  id: step3_python_file
  inputBinding:
    position: 1
  label: step3_python_file
  type: File
- doc: File that contains the partitions in JSON format
  id: step3_input_partitions
  inputBinding:
    position: 2
  label: step3_input_partitions
  type: File
label: step3
outputs:
- doc: Matrix of matches in JSON format generated after executing step3
  id: step3_output_matrix_of_matches
  label: step3_output_matrix_of_matches
  outputBinding:
    glob: matrix_of_matches.json
  type: File
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: logic

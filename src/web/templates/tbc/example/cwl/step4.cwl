$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
baseCommand: python
class: CommandLineTool
cwlVersion: v1.0
doc: CWL file to run automatically step4
id: step4
inputs:
- doc: Python file corresponding to step4
  id: step4_python_file
  inputBinding:
    position: 1
  label: step4_python_file
  type: File
- doc: File that contains the matrix of matches in JSON format
  id: step4_input_matrix_of_matches
  inputBinding:
    position: 2
  label: step4_input_matrix_of_matches
  type: File
label: step4
outputs:
- doc: Final candidate clusters in JSON format generated after executing step4
  id: step4_output_final_candidate_clusters
  label: step4_output_final_candidate_clusters
  outputBinding:
    glob: final_candidate_clusters.json
  type: File
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: logic

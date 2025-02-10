$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
cwlVersion: v1.2
class: CommandLineTool
id: step4
doc: CWL file to run automatically the step 4
baseCommand: python
inputs:
- doc: Python file corresponding to the step 4
  id: step4_python_file
  type: File
  inputBinding:
    position: 1
- doc: File that contains the matrix of matches in JSON format
  id: step4_input_matrix_of_matches
  type: File
  inputBinding:
    position: 2
outputs:
- doc: Final candidate clusters in JSON format generated after executing the step 4
  id: step4_output_final_candidate_clusters
  type: File
  outputBinding:
    glob: 'final_candidate_clusters.json'
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: logic

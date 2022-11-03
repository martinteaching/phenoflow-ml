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
- doc: Path of the file that contains the matrix of matches in JSON format
  id: step4_matrix_of_matches_path
  type: string
  inputBinding:
    position: 2
outputs:
- doc: Final candidate clusters in JSON format generated after executing the step 4
  id: step4_final_candidate_clusters
  type: File
requirements:
  DockerRequirement:
    dockerPull: kclhi/python:latest
s:type: logic

cwlVersion: v1.2
class: CommandLineTool
id: step5
doc: CWL file to run automatically the step 5
baseCommand: python
inputs:
- doc: Python file corresponding to the step 5
  id: step5_python_file
  type: File
  inputBinding:
    position: 1
- doc: Path of the file that contains the final candidate clusters in JSON format
  id: step5_final_candidate_clusters_path
  type: string
  inputBinding:
    position: 2
outputs:
- doc: Final candidate clusters in CSV format generated after executing the step 5
  id: step5_final_candidate_clusters
  type: File
requirements:
  DockerRequirement:
    dockerPull: kclhi/python:latest
s:type: output

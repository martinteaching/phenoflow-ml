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
- doc: Path of the file that contains the partitions in JSON format
  id: step3_partitions_path
  type: string
  inputBinding:
    position: 2
outputs:
- doc: Matrix of matches in JSON format generated after executing the step 3
  id: step3_matrix_of_matches
  type: File
requirements:
  DockerRequirement:
    dockerPull: kclhi/python:latest
s:type: logic

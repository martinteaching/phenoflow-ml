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
- doc: Path of the file that contains the dataset
  id: step2_dataset_path
  type: string
  inputBinding:
    position: 2
outputs:
- doc: Partitions in JSON format generated after executing the step 2
  id: step2_partitions
  type: File
requirements:
  DockerRequirement:
    dockerPull: kclhi/python:latest
s:type: logic

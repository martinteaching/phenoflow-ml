cwlVersion: v1.2
class: CommandLineTool
id: step1
doc: CWL file to run automatically the step 1
baseCommand: python
inputs:
- doc: Python file corresponding to the step 1
  id: step1_python_file
  type: File
  inputBinding:
    position: 1
- doc: Path of the file that contains the input dataset
  id: step1_dataset_path
  type: string
  inputBinding:
    position: 2
outputs:
- doc: Dataset generated after executing the step 1
  id: step1_dataset
  type: File
requirements:
  DockerRequirement:
    dockerPull: kclhi/python:latest
s:type: load

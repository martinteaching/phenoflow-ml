$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
cwlVersion: v1.2
class: CommandLineTool
id: step2
doc: CWL file to automatically run the step 2
baseCommand: python
inputs:
- doc: Python file corresponding to the step 2
  id: step2_python_file
  type: File
  inputBinding:
    position: 1
- doc: Input train dataset corresponding to the step 2
  id: step2_input_train_dataset
  type: File
  inputBinding:
    position: 2
- doc: Input test dataset corresponding to the step 2
  id: step2_input_test_dataset
  type: File
  inputBinding:
    position: 3
outputs:
- doc: Output train dataset corresponding to the step 2 (with predictions)
  id: step2_output_train_dataset_with_predictions
  type: File
  outputBinding:
    glob: 'step2_train_dataset_with_predictions.csv'
- doc: Output test dataset corresponding to the step 2 (with predictions)
  id: step2_output_test_dataset_with_predictions
  type: File
  outputBinding:
    glob: 'step2_test_dataset_with_predictions.csv'
- doc: Model in pickle format
  id: step2_output_pickel_model
  type: File
  outputBinding:
    glob: 'step2_model.pickle'
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: logic

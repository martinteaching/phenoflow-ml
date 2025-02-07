$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
cwlVersion: v1.2
class: CommandLineTool
id: step3
doc: CWL file to automatically run the step 3
baseCommand: python
inputs:
- doc: Python file corresponding to the step 3
  id: step3_python_file
  type: File
  inputBinding:
    position: 1
- doc: Input train dataset corresponding to the step 3 (with predictions)
  id: step3_input_train_dataset_with_predictions
  type: File
  inputBinding:
    position: 2
- doc: Input test dataset corresponding to the step 3 (with predictions)
  id: step3_input_test_dataset_with_predictions
  type: File
  inputBinding:
    position: 3
- doc: Model in pickle format
  id: step3_input_pickle_model
  type: File
  inputBinding:
    position: 4
outputs:
- doc: Train dataset in CSV format with the final predictions
  id: step3_output_train_dataset_with_predictions
  type: File
  outputBinding:
    glob: '*_output_train_dataset_with_predictions.csv'
- doc: Test dataset in CSV format with the final predictions
  id: step3_output_test_dataset_with_predictions
  type: File
  outputBinding:
    glob: '*_output_test_dataset_with_predictions.csv'
- doc: Model in pickle format
  id: step3_output_pickle_model
  type: File
  outputBinding:
    glob: '*.pickle'
requirements:
  DockerRequirement:
    dockerPull: kclhi/regression:latest
s:type: output

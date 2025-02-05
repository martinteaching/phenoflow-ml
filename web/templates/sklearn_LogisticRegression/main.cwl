cwlVersion: v1.2
class: Workflow
steps:
  'step1':
    run: cwl/step1.cwl
    in:
      step1_python_file:
        id: step1_python_file
        source: step1_python_file
      step1_input_train_dataset:
        id: step1_input_train_dataset
        source: step1_input_train_dataset
      step1_input_test_dataset:
        id: step1_input_test_dataset
        source: step1_input_test_dataset
    out:
    - step1_output_train_dataset
    - step1_output_test_dataset
  'step2':
    run: cwl/step2.cwl
    in:
      step2_python_file:
        id: step2_python_file
        source: step2_python_file
      step2_input_train_dataset:
        id: step2_input_train_dataset
        source: step1/step1_output_train_dataset
      step2_input_test_dataset:
        id: step2_input_test_dataset
        source: step1/step1_output_test_dataset
    out:
    - step2_output_train_dataset_with_predictions
    - step2_output_test_dataset_with_predictions
    - step2_output_pickel_model
  'step3':
    run: cwl/step3.cwl
    in:
      step3_python_file:
        id: step3_python_file
        source: step3_python_file
      step3_input_train_dataset_with_predictions:
        id: step3_input_train_dataset_with_predictions
        source: step2/step2_output_train_dataset_with_predictions
      step3_input_test_dataset_with_predictions:
        id: step3_input_test_dataset_with_predictions
        source: step2/step2_output_test_dataset_with_predictions
      step3_input_pickle_model:
        id: step3_input_pickle_model
        source: step2_output_pickel_model
    out:
    - step3_output_train_dataset_with_predictions
    - step3_output_test_dataset_with_predictions
    - step3_output_pickle_model
inputs:
  step1_python_file:
    id: step1_python_file
    doc: Python file corresponding to the step 1
    type: File
  step1_input_train_dataset:
    id: step1_input_train_dataset
    doc: Train dataset corresponding to the step 1
    type: File
  step1_input_test_dataset:
    id: step1_input_test_dataset
    doc: Test dataset corresponding to the step 1
    type: File
  step2_python_file:
    id: step2_python_file
    doc: Python file corresponding to the step 2
    type: File
  step3_python_file:
    id: step3_python_file
    doc: Python file corresponding to the step 3
    type: File
outputs:
  step3_output_train_dataset_with_predictions:
    id: step3_output_train_dataset_with_predictions
    doc: Train dataset in CSV format with the final predictions
    type: File
    outputSource: step3/step3_output_train_dataset_with_predictions
  step3_output_test_dataset_with_predictions:
    id: step3_output_test_dataset_with_predictions
    doc: Test dataset in CSV format with the final predictions
    type: File
    outputSource: step3/step3_output_test_dataset_with_predictions
  step3_output_pickle_model:
    id: step3_output_pickle_model
    doc: Model in pickle format
    outputSource: step3/step3_output_pickle_model
requirements:
  SubworkflowFeatureRequirement: {}

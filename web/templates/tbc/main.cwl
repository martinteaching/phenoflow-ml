cwlVersion: v1.2
class: Workflow
steps:
  'step1':
    run: cwl/step1.cwl
    in:
      step1_python_file:
        id: step1_python_file
        source: step1_python_file
      step1_input_dataset:
        id: step1_input_dataset
        source: step1_input_dataset
    out:
    - step1_output_dataset
  'step2':
    run: cwl/step2.cwl
    in:
      step2_python_file:
        id: step2_python_file
        source: step2_python_file
      step2_input_dataset:
        id: step2_input_dataset
        source: step1/step1_output_dataset
    out:
    - step2_output_partitions
  'step3':
    run: cwl/step3.cwl
    in:
      step3_python_file:
        id: step3_python_file
        source: step3_python_file
      step3_input_partitions:
        id: step3_input_partitions
        source: step2/step2_output_partitions
    out:
    - step3_output_matrix_of_matches
  'step4':
    run: cwl/step4.cwl
    in:
      step4_python_file:
        id: step4_python_file
        source: step4_python_file
      step4_input_matrix_of_matches:
        id: step4_input_matrix_of_matches
        source: step3/step3_output_matrix_of_matches
    out:
    - step4_output_final_candidate_clusters
  'step5':
    run: cwl/step5.cwl
    in:
      step5_python_file:
        id: step5_python_file
        source: step5_python_file
      step5_input_final_candidate_clusters:
        id: step5_input_final_candidate_clusters
        source: step4/step4_output_final_candidate_clusters
    out:
    - step5_output_final_candidate_clusters
inputs:
  step1_python_file:
    id: step1_python_file
    doc: Python file corresponding to the step 1
    type: File
  step1_input_dataset:
    id: step1_input_dataset
    doc: File that contains the input dataset
    type: File
  step2_python_file:
    id: step2_python_file
    doc: Python file corresponding to the step 2
    type: File
  step3_python_file:
    id: step3_python_file
    doc: Python file corresponding to the step 3
    type: File
  step4_python_file:
    id: step4_python_file
    doc: Python file corresponding to the step 4
    type: File
  step5_python_file:
    id: step5_python_file
    doc: Python file corresponding to the step 5
    type: File
outputs:
  step5_output_final_candidate_clusters:
    id: step5_output_final_candidate_clusters
    doc: Final candidate clusters in CSV format generated after executing the step 5
    type: File
    outputSource: step5/step5_output_final_candidate_clusters
requirements:
  SubworkflowFeatureRequirement: {}

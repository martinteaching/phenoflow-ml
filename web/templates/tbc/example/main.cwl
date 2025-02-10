class: Workflow
cwlVersion: v1.0
doc: Main workflow for the Trace-based clustering technique
id: tbc_workflow
inputs:
  step1_input_dataset:
    doc: File that contains the input dataset
    id: step1_input_dataset
    label: step1_input_dataset
    type: File
  step1_python_file:
    doc: Python file corresponding to step1
    id: step1_python_file
    label: step1_python_file
    type: File
  step2_python_file:
    doc: Python file corresponding to step2
    id: step2_python_file
    label: step2_python_file
    type: File
  step3_python_file:
    doc: Python file corresponding to step3
    id: step3_python_file
    label: step3_python_file
    type: File
  step4_python_file:
    doc: Python file corresponding to step4
    id: step4_python_file
    label: step4_python_file
    type: File
  step5_python_file:
    doc: Python file corresponding to step5
    id: step5_python_file
    label: step5_python_file
    type: File
label: tbc_workflow
outputs:
  step5_output_final_candidate_clusters:
    doc: Final candidate clusters in CSV format generated after executing step5
    id: step5_output_final_candidate_clusters
    label: step5_output_final_candidate_clusters
    outputSource: step5/step5_output_final_candidate_clusters
    type: File
requirements:
  SubworkflowFeatureRequirement: {}
steps:
  step1:
    in:
      step1_input_dataset:
        id: step1_input_dataset
        source: step1_input_dataset
      step1_python_file:
        id: step1_python_file
        source: step1_python_file
    out:
    - step1_output_dataset
    run: cwl/step1.cwl
  step2:
    in:
      step2_input_dataset:
        id: step2_input_dataset
        source: step1/step1_output_dataset
      step2_python_file:
        id: step2_python_file
        source: step2_python_file
    out:
    - step2_output_partitions
    run: cwl/step2.cwl
  step3:
    in:
      step3_input_partitions:
        id: step3_input_partitions
        source: step2/step2_output_partitions
      step3_python_file:
        id: step3_python_file
        source: step3_python_file
    out:
    - step3_output_matrix_of_matches
    run: cwl/step3.cwl
  step4:
    in:
      step4_input_matrix_of_matches:
        id: step4_input_matrix_of_matches
        source: step3/step3_output_matrix_of_matches
      step4_python_file:
        id: step4_python_file
        source: step4_python_file
    out:
    - step4_output_final_candidate_clusters
    run: cwl/step4.cwl
  step5:
    in:
      step5_input_final_candidate_clusters:
        id: step5_input_final_candidate_clusters
        source: step4/step4_output_final_candidate_clusters
      step5_python_file:
        id: step5_python_file
        source: step5_python_file
    out:
    - step5_output_final_candidate_clusters
    run: cwl/step5.cwl

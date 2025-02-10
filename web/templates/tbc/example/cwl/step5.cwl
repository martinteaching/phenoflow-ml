$namespaces:
  s: http://phenomics.kcl.ac.uk/phenoflow/
baseCommand: python
class: CommandLineTool
cwlVersion: v1.0
doc: CWL file to run automatically step5
id: step5
inputs:
- doc: Python file corresponding to step5
  id: step5_python_file
  inputBinding:
    position: 1
  label: step5_python_file
  type: File
- doc: File that contains the final candidate clusters in JSON format
  id: step5_input_final_candidate_clusters
  inputBinding:
    position: 2
  label: step5_input_final_candidate_clusters
  type: File
label: step5
outputs:
- doc: Final candidate clusters in CSV format generated after executing step5
  id: step5_output_final_candidate_clusters
  label: step5_output_final_candidate_clusters
  outputBinding:
    glob: '*.csv'
  type: File
requirements:
  DockerRequirement:
    dockerPull: continuumio/anaconda3:2024.10-1
s:type: output

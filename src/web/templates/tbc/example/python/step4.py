# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

# This implementation is based on the paper "A methodology based on Trace-based clustering for patient phenotyping" (DOI: https://doi.org/10.1016/j.knosys.2021.107469 , GITHUB REPO: https://github.com/antoniolopezmc/A-methodology-based-on-Trace-based-clustering-for-patient-phenotyping).

import sys
import json

with open(sys.argv[1], 'r') as file_in, open('final_candidate_clusters.json', 'w') as file_out:
    # Initial parameters.
    threshold = 0.6
    # Read the matrix of matches generated in the previous step.
    matrix_of_matches = json.load(file_in)
    # Dictionary in which the final results will be stored.
    dictionary_final_candidate_clusters = dict()
    # Iterate over the matrix of matches.
    for cluster_key in matrix_of_matches:
        current_cluster = matrix_of_matches[cluster_key]
        # For each cluster, iterate over the previous partitions.
        previous_partitions = current_cluster["match_with_previous_partitions"]
        # All values of match.
        values_of_match = []
        for partition_key in previous_partitions:
            current_previous_partition = previous_partitions[partition_key]
            values_of_match.append( current_previous_partition["max_value_of_match"] )
        # Compute the mean.
        mean_value_of_match = sum(values_of_match) / len(values_of_match)
        # Compare the mean with the threshold.
        if mean_value_of_match >= threshold:
            # Add the current cluster to the final result.
            dictionary_final_candidate_clusters[cluster_key] = matrix_of_matches[cluster_key]
    # Finally, we convert all to json format and write to the output file.
    json.dump(dictionary_final_candidate_clusters, file_out, indent=4)

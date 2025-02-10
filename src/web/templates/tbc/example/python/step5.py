# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

# This implementation is based on the paper "A methodology based on Trace-based clustering for patient phenotyping" (DOI: https://doi.org/10.1016/j.knosys.2021.107469 , GITHUB REPO: https://github.com/antoniolopezmc/A-methodology-based-on-Trace-based-clustering-for-patient-phenotyping).

import sys
import json

with open(sys.argv[1], 'r') as file_in, open('name_tbc001_id_6_output.csv', 'w') as file_out:
    # Read the final candidate clusters generated in the previous step.
    final_candidate_clusters = json.load(file_in)
    # Write in the output file.
    file_out.write('"instance index of the initial dataset (starting from 0)","cluster name (starting from 0 and from the partition with 5 clusters)","mean value of match with previous partitions"\n')
    # Iterate over the final candidate clusters.
    for cluster_name in final_candidate_clusters:
        current_cluster = final_candidate_clusters[cluster_name]
        # For each cluster, iterate over the previous partitions.
        previous_partitions = current_cluster["match_with_previous_partitions"]
        # All values of match.
        values_of_match = []
        for partition_key in previous_partitions:
            current_previous_partition = previous_partitions[partition_key]
            values_of_match.append( current_previous_partition["max_value_of_match"] )
        # Compute the mean.
        mean_value_of_match = sum(values_of_match) / len(values_of_match)
        # For each cluster, iterate over its instances.
        for instance_index in current_cluster["instances"]:
            file_out.write(str(instance_index) + "," + cluster_name + "," + str(mean_value_of_match) + "\n")

# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

# This implementation is based on the paper "A methodology based on Trace-based clustering for patient phenotyping" (DOI: https://doi.org/10.1016/j.knosys.2021.107469 , GITHUB REPO: https://github.com/antoniolopezmc/A-methodology-based-on-Trace-based-clustering-for-patient-phenotyping).

import sys
import json

with open(sys.argv[1], 'r') as file_in, open('matrix_of_matches.json', 'w') as file_out:
    # Initial parameters.
    k = 5
    # Read all partitions generated in the previous step.
    partitions = json.load(file_in)
    # Dictionary in which the final results will be stored.
    dictionary_matrix_of_matches = dict()
    # Iterate over the clusters of the partition with more clusters (i.e., from cluster 0 to cluster k-1).
    for cluster_number_of_partition_k in range(0, k):
        dictionary_matrix_of_matches["partition_k_"+str(k)+"_cluster_"+str(cluster_number_of_partition_k)] = dict()
        dictionary_matrix_of_matches["partition_k_"+str(k)+"_cluster_"+str(cluster_number_of_partition_k)]["instances"] = partitions["partition_k_"+str(k)]["cluster_"+str(cluster_number_of_partition_k)]
        dictionary_matrix_of_matches["partition_k_"+str(k)+"_cluster_"+str(cluster_number_of_partition_k)]["match_with_previous_partitions"] = dict()
        # Python set with the indexes of the instances from the original dataset.
        cluster_of_partition_k = set( partitions["partition_k_"+str(k)]["cluster_"+str(cluster_number_of_partition_k)] )
        # Iterate over the previous partitions (from the partition 2 to the partition k-1).
        for partition_number in range(2, k):
            dictionary_matrix_of_matches["partition_k_"+str(k)+"_cluster_"+str(cluster_number_of_partition_k)]["match_with_previous_partitions"]["partition_k_"+str(partition_number)] = dict()
            max_value_of_match = float("-inf")
            cluster_with_max_value_of_match = None
            # Iterate over the clusters of the current partition.
            for cluster_number in range(0,partition_number):
                cluster_of_current_partition = set( partitions["partition_k_"+str(partition_number)]["cluster_"+str(cluster_number)] )
                value_of_match = (2*len(cluster_of_partition_k.intersection(cluster_of_current_partition))) / (len(cluster_of_partition_k)+len(cluster_of_current_partition))
                if value_of_match > max_value_of_match:
                    max_value_of_match = value_of_match
                    cluster_with_max_value_of_match = "partition_k_"+str(partition_number)+"_cluster_"+str(cluster_number)
            dictionary_matrix_of_matches["partition_k_"+str(k)+"_cluster_"+str(cluster_number_of_partition_k)]["match_with_previous_partitions"]["partition_k_"+str(partition_number)]["max_value_of_match"] = max_value_of_match
            dictionary_matrix_of_matches["partition_k_"+str(k)+"_cluster_"+str(cluster_number_of_partition_k)]["match_with_previous_partitions"]["partition_k_"+str(partition_number)]["cluster_with_max_value_of_match"] = cluster_with_max_value_of_match
    # Finally, we convert all to json format and write to the output file.
    json.dump(dictionary_matrix_of_matches, file_out, indent=4)

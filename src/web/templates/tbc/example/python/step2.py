# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

# This implementation is based on the paper "A methodology based on Trace-based clustering for patient phenotyping" (DOI: https://doi.org/10.1016/j.knosys.2021.107469 , GITHUB REPO: https://github.com/antoniolopezmc/A-methodology-based-on-Trace-based-clustering-for-patient-phenotyping).

import sys
from pandas import read_csv
# We force that all clustering algorithms are from 'sklearn.cluster' to maintain the same interface.
from sklearn.cluster import KMeans
import json

# IMPORTANT: it is not necessary to use 'open' with the file_input, since it will be read by pandas.
with open('partitions.json', 'w') as file_out:
    # Initial parameters.
    random_seed = 100
    k = 5
    # Read the input dataset.
    pandas_dataframe = read_csv(sys.argv[1])
    # Dictionary in which the final results will be stored.
    dictionary_of_partitions = dict()
    # The random seed will be different on each call to the clustering algorithm.
    current_random_seed = random_seed
    # Generate all partitions (from 'number_of_cluster=2' to 'number_of_cluster=k').
    for number_of_clusters in range(2, k+1):
        # Run the clustering algorithm.
        algorithm_result = KMeans(n_clusters=number_of_clusters, random_state=current_random_seed).fit(pandas_dataframe)
        # For the current partition, generate all its clusters (from 0 to 'number_of_clusters - 1').
        dictionary_of_clusters = dict()
        for cluster in range(0,number_of_clusters):
            # Dataframe with only the elements/rows of the original pandas dataframe in the cluster number 'cluster'.
            sub_dataframe = pandas_dataframe[algorithm_result.labels_ == cluster]
            # Get the list of indexes of the sub_dataframe and add them to the list 'dictionary_of_clusters'. 
            dictionary_of_clusters["cluster_"+str(cluster)] = sub_dataframe.index.tolist()
        # current_random_seed + 3
        current_random_seed = current_random_seed + 3
        # Add the current partition to the dictionary.
        dictionary_of_partitions["partition_k_"+str(number_of_clusters)] = dictionary_of_clusters
    # Finally, we convert all to json format and write to the output file.
    json.dump(dictionary_of_partitions, file_out, indent=4)

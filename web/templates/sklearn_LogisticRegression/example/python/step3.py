# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

import sys
import pandas as pd
import pickle

# Read the datasets.
train_dataset_with_predictions = pd.read_csv(sys.argv[1])
test_dataset_with_predictions = pd.read_csv(sys.argv[2])
# Write the datasts.
train_dataset_with_predictions.to_csv("name_exampple_id_1_output_train_dataset_with_predictions.csv")
test_dataset_with_predictions.to_csv("name_example_id_1_output_test_dataset_with_predictions.csv")
# Read the model.
input_model_file = open(sys.argv[3], "rb")
output_model_file = open("name_example_id_1_output_pickle_model.pickle", "wb")
pickle.dump(pickle.load(input_model_file), output_model_file)
input_model_file.close()
output_model_file.close()

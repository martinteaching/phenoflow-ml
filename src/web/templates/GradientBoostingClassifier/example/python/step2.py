# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

import sys
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
import pickle

_params = {
    "loss" : 'log_loss',
    "learning_rate" : 0.1,
    "n_estimators" : 100,
    "subsample" : 1.0,
    "criterion" : 'friedman_mse',
    "min_samples_split" : 2,
    "min_samples_leaf" : 1,
    "min_weight_fraction_leaf" : 0.0,
    "max_depth" : 3,
    "min_impurity_decrease" : 0.0,
    "init" : None,
    "random_state" : None,
    "max_features" : None,
    "verbose" : 0,
    "max_leaf_nodes" : None,
    "warm_start" : False,
    "validation_fraction" : 0.1,
    "n_iter_no_change" : None,
    "tol" : 0.0001,
    "ccp_alpha" : 0.0
}

# Class name.
class_name = "Class"
att_name_for_predictions = class_name + "_pred"
# Read the input datasets.
train_dataset = pd.read_csv(sys.argv[1])
test_dataset = pd.read_csv(sys.argv[2])
# Create the output datasets.
train_dataset_with_predictions = train_dataset.copy()
test_dataset_with_predictions = test_dataset.copy()
# Create the model.
random_state_value = 100 or _params["random_state"]
model = GradientBoostingClassifier(loss = _params["loss"], learning_rate = _params["learning_rate"], n_estimators = _params["n_estimators"],
                                   subsample = _params["subsample"], criterion = _params["criterion"], min_samples_split = _params["min_samples_split"],
                                   min_samples_leaf = _params["min_samples_leaf"], min_weight_fraction_leaf = _params["min_weight_fraction_leaf"],
                                   max_depth = _params["max_depth"], min_impurity_decrease = _params["min_impurity_decrease"], init = _params["init"],
                                   random_state = random_state_value, max_features = _params["max_features"], verbose = _params["verbose"],
                                   max_leaf_nodes = _params["max_leaf_nodes"], warm_start = _params["warm_start"],
                                   validation_fraction = _params["validation_fraction"], n_iter_no_change = _params["n_iter_no_change"],
                                   tol = _params["tol"], ccp_alpha = _params["ccp_alpha"])
# Split the train data into X and y.
X = train_dataset.drop(columns=[class_name], inplace=False)
y = train_dataset[class_name]
# Fit.
model.fit(X, y)
# Predict with the train dataset and add the new attribute.
train_dataset_with_predictions[att_name_for_predictions] = pd.Series(model.predict(X))
# Predict with the test dataset and add the new attribute.
if class_name in test_dataset.columns:
    test_dataset_with_predictions[att_name_for_predictions] = pd.Series(model.predict(test_dataset.drop(columns = [class_name], inplace = False)))
else:
    test_dataset_with_predictions[att_name_for_predictions] = pd.Series(model.predict(test_dataset))
# Write the results to disk.
train_dataset_with_predictions.to_csv("step2_train_dataset_with_predictions.csv", index = False)
test_dataset_with_predictions.to_csv("step2_test_dataset_with_predictions.csv", index = False)
model_file = open("step2_model.pickle", "wb")
pickle.dump(model, model_file)
model_file.close()

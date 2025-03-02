# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

import sys
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
import pickle

_params = {
    "criterion" : 'gini',
    "splitter" : 'best',
    "max_depth" : None,
    "min_samples_split" : 2,
    "min_samples_leaf" : 1,
    "min_weight_fraction_leaf" : 0.0,
    "max_features" : None,
    "random_state" : None,
    "max_leaf_nodes" : None,
    "min_impurity_decrease" : 0.0,
    "class_weight" : None,
    "ccp_alpha" : 0.0,
    "monotonic_cst" : None
}

# Class name.
class_name = <CLASS_NAME>
att_name_for_predictions = class_name + "_pred"
# Read the input datasets.
train_dataset = pd.read_csv(sys.argv[1])
test_dataset = pd.read_csv(sys.argv[2])
# Create the output datasets.
train_dataset_with_predictions = train_dataset.copy()
test_dataset_with_predictions = test_dataset.copy()
# Create the model.
random_state_value = <RANDOM_STATE> or _params["random_state"]
model = DecisionTreeClassifier(
    criterion = _params["criterion"],
    splitter = _params["splitter"],
    max_depth = _params["max_depth"],
    min_samples_split = _params["min_samples_split"],
    min_samples_leaf = _params["min_samples_leaf"],
    min_weight_fraction_leaf = _params["min_weight_fraction_leaf"],
    max_features = _params["max_features"],
    random_state = random_state_value,
    max_leaf_nodes = _params["max_leaf_nodes"],
    min_impurity_decrease = _params["min_impurity_decrease"],
    class_weight = _params["class_weight"],
    ccp_alpha = _params["ccp_alpha"],
    monotonic_cst = _params["monotonic_cst"]
    )
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

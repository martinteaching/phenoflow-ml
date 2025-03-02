# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

import sys
import pandas as pd
from sklearn.svm import SVC
import pickle

_params = {
    "C" : 1.0,
    "kernel" : 'rbf',
    "degree" : 3,
    "gamma" : 'scale',
    "coef0" : 0.0,
    "shrinking" : True,
    "probability" : False,
    "tol" : 0.001,
    "cache_size" : 200,
    "class_weight" : None,
    "verbose" : False,
    "max_iter" : -1,
    "decision_function_shape" : 'ovr',
    "break_ties" : False,
    "random_state" : None
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
model = SVC(C = _params["C"], kernel = _params["kernel"], degree = _params["degree"], gamma = _params["gamma"], coef0 = _params["coef0"],
            shrinking = _params["shrinking"], probability = _params["probability"], tol = _params["tol"], cache_size = _params["cache_size"],
            class_weight = _params["class_weight"], verbose = _params["verbose"], max_iter = _params["max_iter"],
            decision_function_shape = _params["decision_function_shape"], break_ties = _params["break_ties"], random_state = random_state_value)
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

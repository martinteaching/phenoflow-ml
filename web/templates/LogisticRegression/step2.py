# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

import sys
import pandas as pd
from sklearn.linear_model import LogisticRegression
import pickle

_params = {
    "penalty" : 'l2',
    "dual" : False,
    "tol" : 0.0001,
    "C" : 1.0,
    "fit_intercept" : True,
    "intercept_scaling" : 1,
    "class_weight" : None,
    "random_state" : None,
    "solver" : 'lbfgs',
    "max_iter" : 100,
    "verbose" : 0,
    "warm_start" : False,
    "n_jobs" : None,
    "l1_ratio" : None
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
model = LogisticRegression(penalty = _params["penalty"], dual = _params["dual"], tol = _params["tol"], C = _params["C"],
                           fit_intercept = _params["fit_intercept"], intercept_scaling = _params["intercept_scaling"],
                           class_weight = _params["class_weight"], random_state = random_state_value, solver = _params["solver"],
                           max_iter = _params["max_iter"], verbose = _params["verbose"], warm_start = _params["warm_start"],
                           n_jobs = _params["n_jobs"], l1_ratio = _params["l1_ratio"])
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

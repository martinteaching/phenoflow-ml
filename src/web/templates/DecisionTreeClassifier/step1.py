# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

import sys
from pandas import read_csv

train_dataset = read_csv(sys.argv[1])
train_dataset.to_csv('name_<WORKFLOW_NAME>_id_<WORKFLOW_ID>_train_dataset.csv', index = False)
test_dataset = read_csv(sys.argv[2])
test_dataset.to_csv('name_<WORKFLOW_NAME>_id_<WORKFLOW_ID>_test_dataset.csv', index = False)

# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

import sys
from pandas import read_csv

train_dataset = read_csv(sys.argv[1])
train_dataset.to_csv('name_rf001_id_1_train_dataset.csv', index = False)
test_dataset = read_csv(sys.argv[2])
test_dataset.to_csv('name_rf001_id_1_test_dataset.csv', index = False)

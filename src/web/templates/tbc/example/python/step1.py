# -*- coding: utf-8 -*-

# Author:
#    Antonio Lopez-Martinez-Carrasco <antoniolopezmc@um.es>

# This implementation is based on the paper "A methodology based on Trace-based clustering for patient phenotyping" (DOI: https://doi.org/10.1016/j.knosys.2021.107469 , GITHUB REPO: https://github.com/antoniolopezmc/A-methodology-based-on-Trace-based-clustering-for-patient-phenotyping).

import sys

with open(sys.argv[1], 'r') as file_in, open('name_tbc001_id_6_dataset.csv', 'w') as file_out:
    file_content = file_in.read()
    file_out.write(file_content)

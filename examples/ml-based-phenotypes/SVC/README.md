# About this document

The purpose of this document is to show an example of the creation of an ML phenotype based on the Support Vector Classification technique.

In this case, the creation process is carried out by using the Phenoflow API and the Postman software, which is used to send HTTP requests to such API.

# Prerequisites

Before starting with the creation of this type of phenotype, it is necessary to ensure that:
  1. The Phenoflow infrastructure is properly deployed (either in our local machine or a remote server). For that, follow the steps from the README.md file of the root directory of this repository.
  2. The Postman software is installed on our machine (see https://www.postman.com/).

# Creation process

The creation process is divided into three steps: (1) add a new Support Vector Classification phenotype, (2) upload the necessary CSV datasets (train and test), and (3) generate the corresponding phenotype files.

## 1. Add a new Support Vector Classification phenotype

The first step consists of creating a new definition of the Support Vector Classification, which implies adding all the necessary components to the system (workflow, steps, inputs, outputs, etc.). For that, the **addPhenotype** endpoint is used, which is of type POST and takes different parameters (in the form-data) as input. An example is shown as follows:

![alt text](1.png "SupportVectorClassification")

## 2. Upload the necessary CSV datasets

When the definition is created, the next step consists of uploading both datasets (train and test) to the system. For that, the **uploadCsvDataset** endpoint is used. It is of type POST and takes different parameters (in the form-data) as input. An example is shown as follows:

![alt text](2.png "SupportVectorClassification")

![alt text](3.png "SupportVectorClassification")

## 3. Generate the phenotype files

The last step is to generate and download the CWL workflow. For that, the **generate** endpoint is used. This endpoint is of GET type and contains different parameters, that need to be added to the URL. When executing this endpoint, the templates of the Support Vector Classification technique are customized with the properties stored in the system of the current Support Vector Classification phenotype. An example is shown as follows:

![alt text](4.png "SupportVectorClassification")

# Visualization

Once the CWL workflow is generated, it can be visualized using the Common Workflow Language Viewer tool (https://view.commonwl.org/).

![alt text](5.png "SupportVectorClassification")

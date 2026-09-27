Short-term electricity demand forecasting for Tetouan City
Course report template (Data Science)

This repository is a template. The LaTeX report is written in English and
follows the HUST report layout. Result tables use square brackets such as
[XX]. Fill those cells from source_code/outputs/metrics.json after you run
the pipeline. Replace the figure boxes in the report with the PNG files the
pipeline writes.

Layout
------
Readme.txt                 this file
report/                    LaTeX report (main.tex, chapters/, figures/)
source_code/               Python project
  requirements.txt
  run_pipeline.py          download, aggregate, train, evaluate
  app.py                   Streamlit forecast and capacity alert
  src/data_loader.py       UCI download and hourly aggregation
  src/feature_engineering.py
  src/models.py            seasonal naive, ridge, random forest, XGBoost, LightGBM
  src/evaluation.py        MAE, RMSE, WAPE, peak metrics, figures

1. Setup
--------
Python 3.12 is required.

  cd source_code
  python -m venv .venv
  .venv\Scripts\activate
  python -m pip install -r requirements.txt

On macOS or Linux, activate with:  source .venv/bin/activate

The first training run downloads the UCI file
"Power Consumption of Tetouan City" into source_code/data/raw/.
Later runs reuse that file.

2. Run the software
-------------------
From source_code, with the virtual environment active:

  python run_pipeline.py
  python -m streamlit run app.py

run_pipeline.py writes:
  outputs/metrics.json       numbers for the report tables
  outputs/predictions.csv    series shown in the dashboard
  outputs/figures/*.png      charts named in the report

The dashboard does not retrain. It reads outputs/. If those files are
missing, the page tells you to run run_pipeline.py.

3. Compile the report
---------------------
A TeX installation with pdflatex is required (MiKTeX or TeX Live).

Windows, from the report folder:

  compile.bat

compile.ps1 is the same build, but this PC blocks .ps1 files. If you still
want the PowerShell script, run it once with:

  powershell -ExecutionPolicy Bypass -File compile.ps1

macOS or Linux:

  bash compile.sh

Or run pdflatex three times on report/main.tex. The bibliography is inside
the TeX sources, so BibTeX is not used.

Before the final PDF, edit report/main.tex and replace:
  [Lecturer name], [Student ID], [email]
and any extra group members.

Then copy the PNG charts into report/figures/ and swap each figure
placeholder for \includegraphics, as described in report/chapters/8_appendix.tex.

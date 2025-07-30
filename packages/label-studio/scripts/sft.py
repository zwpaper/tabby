import time

import vertexai
from vertexai.tuning import sft

PROJECT_ID = "gen-lang-client-0005535210"
vertexai.init(project=PROJECT_ID, location="us-central1")

sft_tuning_job = sft.train(
    source_model="gemini-2.5-pro",
    train_dataset="gs://pochi-fine-tuning/merged-010-to-012/train.jsonl",
    validation_dataset="gs://pochi-fine-tuning/merged-010-to-012/validation.jsonl",
    tuned_model_display_name="20250730-merged-010-to-012-pro",
)

sft_tuning_job = sft.train(
    source_model="gemini-2.5-flash",
    train_dataset="gs://pochi-fine-tuning/merged-010-to-012/train.jsonl",
    validation_dataset="gs://pochi-fine-tuning/merged-010-to-012/validation.jsonl",
    tuned_model_display_name="20250730-merged-010-to-012-flash",
)
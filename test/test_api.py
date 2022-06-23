from fastapi import FastAPI
from fastapi.testclient import TestClient
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{current_dir}/../api")

from api import app
client = TestClient(app)


def test_read_main():
    response = client.get("/v1/projects")
    assert response.status_code == 200

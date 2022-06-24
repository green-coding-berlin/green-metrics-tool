import requests
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(f"{current_dir}/../api")


API_URL="http://api.green-coding-nginx-container:8000"


def test_read_main():
    response = requests.get(f"{API_URL}/v1/projects")
    assert response.status_code == 200

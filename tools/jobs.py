import sys, os
import runner
import subprocess

sys.path.append(os.path.dirname(os.path.abspath(__file__))+'/../lib')
import error_helpers
import email_helpers
import setup_functions

from db import DB
from runner import Runner

def insert_job(job_type, project_id=None):
    query = """
            INSERT INTO
                jobs (type, failed, running, created_at, project_id)
            VALUES
                (%s, FALSE, FALSE, NOW(), %s) RETURNING id;
            """
    params = (job_type, project_id,)
    job_id = DB().fetch_one(query, params=params)[0]
    return job_id

# do the first job you get.
def get_job(job_type):
    clear_old_jobs()
    query = "SELECT id, type, project_id FROM jobs WHERE failed=false AND type=%s ORDER BY created_at ASC LIMIT 1"

    data = DB().fetch_one(query, (job_type,))

    if(data is None or data == []):
        print("No job to process. Exiting")
        exit(0)

    match data[1]:
        case "email":
            do_email_job(data[0], data[2])
        case "project":
            do_project_job(data[0], data[2])
        case _:
            raise RuntimeError(f"Job w/ id {data[0]} has unkown type: {data[1]}.")

def delete_job(job_id):
    query = "DELETE FROM jobs WHERE id=%s AND failed=FALSE"
    params = (job_id,)
    DB().query(query, params=params)

# if there is no job of that type running, set this job to running
def check_job_running(job_type, job_id):
    query = "SELECT FROM jobs WHERE running=true AND type=%s"
    params = (job_type,)
    data = DB().fetch_one(query, params=params)
    if data is not None:
        error_helpers.log_error('Job was still running: ', job_type, job_id) # No email here, only debug
        exit(1) #is this the right way to exit here?
    else:
        query_update = "UPDATE jobs SET running=true WHERE id=%s"
        params_update =  (job_id,)
        DB().query(query_update, params=params_update)

def clear_old_jobs():
    query = "DELETE FROM jobs WHERE created_at < NOW() - INTERVAL '20 minutes' AND failed=false"
    DB().query(query)

def do_email_job(job_id, project_id):
    check_job_running('email', job_id)

    query = "SELECT email FROM projects WHERE id = %s"
    params = (project_id,)
    data = DB().fetch_one(query, params=params)
    if(data is None or data == []):
        raise RuntimeError(f"couldn't find project w/ id: {project_id}")

    try:
        from email_helpers import send_report_email
        send_report_email(data[0], project_id)
        delete_job(job_id)
    except Exception as e:
        error_helpers.email_and_log_error("Exception occured: ", e)
        DB().query("UPDATE jobs SET failed=true WHERE id=%s", params=(job_id,))

def do_project_job(job_id, project_id):
    #check_job_running('project', job_id)

    data = DB().fetch_one("SELECT id,uri,email FROM projects ORDER BY created_at ASC LIMIT 1")

    if(data is None or data == []):
        print("No job to process. Exiting")
        exit(0)

    project_id = data[0]
    uri = data[1]
    email = data[2]

    runner = Runner()
    try:
        runner.run(uri=uri, uri_type='URL', project_id=project_id) # Start main code. Only URL is allowed for cron jobs
        runner.cleanup()
        insert_job("project", project_id=project_id)
    except BaseException as e:
        error_helpers.log_error("Base exception occured in runner.py: ", e)
        runner.cleanup() # catch so we can cleanup
        raise e

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("type", help="Select the operation mode.", choices=['email', 'project'])
    #parser.add_argument("--url", type=str, help="The url to download the repository with the usage_scenario.json from. Will only be read in manual mode.")
    #parser.add_argument("--unsafe", action='store_true', help="Activate unsafe volume bindings, portmappings and complex env vars")

    args = parser.parse_args() # script will exit if url is not present

    #p = "05b48a9c-3e83-4ea9-8f25-3201e2349302"
    #print("Inserted Job ID: ", insert_job("project", p))
    try:
        get_job(args.type)
    except Exception as e:
        error_helpers.log_error("Base exception occured in jobs.py: ", e)
        email_helpers.send_error_email(setup_functions.get_config()['admin']['email'], error_helpers.format_error("Base exception occured in jobs.py: ", e), project_id=None)



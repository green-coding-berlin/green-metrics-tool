import argparse
import subprocess
import json
import os
import signal
import time
import traceback
import sys
import re

def insert_hw_info(conn, project_id):
    with open("/proc/cpuinfo", "r")  as f:
        info = f.readlines()
    
    cpuinfo = [x.strip().split(": ")[1] for x in info if "model name"  in x]
    #print(cpuinfo[0])

    with open("/proc/meminfo", "r") as f:
        lines = f.readlines()
    memtotal = re.search(r"\d+", lines[0].strip())
    #print(memtotal.group())

    #lshw_output = subprocess.check_output(["lshw", "-C", "display"])
    #gpuinfo = re.search(r"product: (.*)$", lshw_output.decode("UTF-8"))
    #print(gpuinfo.group())

    cur = conn.cursor()
    cur.execute("""UPDATE projects 
        SET cpu=%s, memtotal=%s
        WHERE id = %s
        """, (cpuinfo[0], memtotal.group(), project_id))
    conn.commit()
    cur.close()

if __name__ == "__main__":

    import argparse
    import yaml
    import os
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__))+'/../lib')
    from setup_functions import get_config, get_db_connection
    from errors import log_error

    config = get_config()
    conn = get_db_connection(config)

    p = "87851711-866f-433e-8117-2c54045a90ec-watev"

    insert_hw_info(conn, p)

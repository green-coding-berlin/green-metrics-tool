Installing the toolchain takes about 30 Minutes to 1 hour, depending on linux knowledge.

Important: If you ever get stuck during this installation, be sure to reboot the machine once. It may help to correctly load / reload some configuration and / or daemons.

The tool requires a linux distribution as foundation, a webserver (instructions only given for NGINX, but any webserver will do)
python3 including some packages and docker installed (rootless optional).

We will directly install to /w as the tool should be run on a dedicated node anyway.
This is because of the competing resource allocation when run in a shared mode and also
because of security concerns.

We recommend to fully reset the node after every run, so no data from the previous run
remains in memory or on disk.

`git clone https://github.com/green-coding-berlin/green-metrics-tool /var/www/green-metrics-tool`

`sudo apt update`

`sudo apt dist-upgrade -y`

`sudo apt install postgresql python3 python3-pip gunicorn nginx libpq-dev python-dev postgresql-contrib -y`

`sudo pip3 install psycopg2 flask pandas pyyaml`\
The sudo in the last command is very important, as it will tell pip to install to /usr directory instead to the home directory. So we can find the package later with other users on the system. If you do not want that use a venv in Python.

### Docker
Docker provides a great installation help on their website that will probably be more up2date than this readme: https://docs.docker.com/engine/install/

However, we provide here what we typed in on our Ubuntu system, but be sure to double check on the official website. Especially if you are not running Ubuntu.

#### Base install

`curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg`

`echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null`

`sudo apt update`

`sudo apt remove docker docker-engine docker.io containerd runc`

`sudo apt-get install ca-certificates curl gnupg lsb-release`

`sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin`

You can check if all is working fine by running `docker stats`. It should connect to the docker daemon and output a "top" like view, which is empty for now.

#### Rootless mode (strongly recommended)

If you want rootless mode however be sure to follow the instructions here: https://docs.docker.com/engine/security/rootless/
After running the dockerd-rootless-setuptool.sh script, you may need to add some lines to your .bashrc file.
Also you need to have a non-root user in place before you go through this process :)

The process may pose some challenges, as depending on your system some steps might fail. We created a small summary of our commands,
but these are subject to change.

#### Important: 
Before doing these steps be sure to relog into your system (either through relogging, or doing a new ssh login) with the non-root user.

A switch with "su my_user" will break and make install impossible.

`sudo systemctl disable --now docker.service docker.socket`

`sudo apt install uidmap`


`sudo apt update` 

`sudo apt-get install -y docker-ce-rootless-extras dbus-user-session`

`dockerd-rootless-setuptool.sh install`

Be sure now to add the export commands that are outputted to your .bashrc or similar.

`systemctl --user enable docker`

`sudo loginctl enable-linger $(whoami)`


And you must also enable the cgroup2 support with the metrics granted for the user: https://rootlesscontaine.rs/getting-started/common/cgroup2/
Make sure to also enable the CPU, CPUTSET, and I/O delegation.

### Postgres
`sudo -i -u postgres`

`createuser my_user -P # and then type password`

`createdb --encoding=UTF-8 --owner=my_user my_user # DB is often already created with previous command`

`psql # make sure you are postgres user (whoami)`

this command in psql: ` ALTER USER my_user WITH SUPERUSER;`

leave the psql shell (ctrl+d) and also logout of "postgres" bash

`psql -U my_user # needs PW entry`

this command in psql: `CREATE EXTENSION "uuid-ossp";`

leave the psql shell (ctrl+d)

make sure you are a postgres user with `sudo -i -u postgres`

`psql` 

this command in psql: `ALTER USER my_user WITH SUPERUSER;`

leave the psql shell (ctrl+d) and logout of "postgres" bash

now we import the structure

`psql -U my_user < /var/www/green-metrics-tool/structure.sql`


#### Postgres Remote access (optional)
check first if 12 is really used version and then maybe replace number in next command

`echo "listen_addresses = '*'" >> /etc/postgresql/12/main/postgresql.conf`

`sudo nano /etc/postgresql/12/main/pg_hba.conf`

add the following lines to the config. It must come BEFORE any lines that are talking about "peer" authentication.\
Otherwise peer authentication will be prefered and password login will fail in python3-psycopg2:

`host my_user my_user 0.0.0.0/0 md5`\
`local my_user my_user md5`

maybe even remove other hosts as needed. Then reload

`sudo systemctl reload postgresql`

### Webservice
we are using `/var/www/green-metrics-tool/website` for static files and as document root
and `/var/www/green-metrics-tool/api` for the API

all must be owned by www-data (or the nginx user if different)

`sudo chown -R www-data:www-data /var/www`

now we replace the references in the code with the real server address you are running on
`cd /var/www/green-metrics-tool`

`sudo sed -i "s/http:\/\/127\.0\.0\.1:8080/http://YOUR_URL_OR_IP_ESCAPED_HERE/" website/index.html`

`sudo sed -i "s/http:\/\/127\.0\.0\.1:8080/http://YOUR_URL_OR_IP_ESCAPED_HERE/" website/request.html`


## Configuring the command line application
Create the file `/var/www/green-metrics-tool/config.yml` with the correct Database and SMTP credentials. 
A sample setup for the file can be found in `/var/www/green-metrics-tool/config.yml.example`


#### Gunicorn
test if gunicorn is working in general
`cd /var/www/green-metrics-tool/api && gunicorn --bind 0.0.0.0:5000 wsgi:app`

if all is working, we create the service for gunicorn
`sudo nano /etc/systemd/system/green-coding-api.service`

paste this:
```
[Unit]
Description=Gunicorn instance to serve Green Coding API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/green-metrics-tool/api
ExecStart=/bin/gunicorn --workers 3 --bind unix:green-coding-api.sock -m 007 wsgi:app

[Install]
WantedBy=multi-user.target
```

`sudo systemctl enable --now green-coding-api.service`

#### NGINX

`sudo nano /etc/nginx/sites-available/green-coding-api`

Paste this, but change "your-domain.com" to either your domain or the server ip:
```
server {
    listen 8080;
    server_name your_domain.com www.your_domain.com;

    location / {
        include proxy_params;
        proxy_pass http://unix:/var/www/api/green-coding-api.sock;
    }
}
```

`sudo ln -s /etc/nginx/sites-available/green-coding-api /etc/nginx/sites-enabled/`

and we also must change the default document root

`sudo nano /etc/nginx/sites-available/default`

here you must modify the root directive to: `root /var/www/green-metrics-tool/website;`

Then reload all:
`sudo systemctl restart nginx`


***Now create a snapshot of the machine to reload this state later on***


## Testing the command line application
First you have to create a project through the web interface, so the cron runner will pick it up from the database.

Go to http://YOUR_CONFIGURED_URL/request.html
Note: You must enter a Github Repo URL with a repository that has the usage_scenario.json in a valid format. Consult [Github Repository for the Demo software](https://github.com/green-coding-berlin/green-metric-demo-software) for more info

After creating project run:

`/var/www/tools/runner.sh cron`

## Implement a cronjob (optional)
Run this command as the user for which docker is configured:
`crontab -e`

Then install following cron for `root` to run job every 15 min:

`*/15     *       *       *       *       rm -Rf /tmp/repo; python3 /var/www/tools/runner.py cron`

If you have no MTA installed you can also pipe the output to a specific file like so:

`*/15     *       *       *       *       rm -Rf /tmp/repo; python3 /var/www/tools/runner.py cron 2>&1 >> /var/log/cron-green-metric.log`

If you have docker configured to run in rootless mode be sure to issue the exports for the cron command beforehand.
A cronjob in the `crontab -e` of the non-root may look similar to this one:

`
DOCKER_HOST=unix:///run/user/1000/docker.sock
*/5     *       *       *       *       export PATH=/home/USERNAME/bin:$PATH; rm -Rf /tmp/repo; python3 /var/www/tools/runner.py cron 2>&1 >> /var/log/cron-green-metric.log`

Also make sure that `/var/log/cron-green-metric.log` is writeable by the user:

`sudo touch /var/log/cron-green-metric.log && sudo chown MY_USER:MY_USER /var/log/cron-green-metric.log`

### Locking and Timeout for cron
Depending on how often you run the cronjob and how long your jobs are the cronjobs may interleave which
will cause problems.

On a typical Linux system you can use timeout / flock to prevent this.
This example creates a exclusive lock and timeouts to 4 minutes

`
DOCKER_HOST=unix:///run/user/1000/docker.sock
*/5     *       *       *       *       export PATH=/home/USERNAME/bin:$PATH
; timeout 240s flock -nx /var/lock/greencoding-runner rm -Rf /tmp/repo && python3 /var/www/tools/runner.py cron 2>&1 >> /var/log/cron-green-metric.log`
Setup with Docker Compose
-------------------------

Docker Compose is great to set up all environment with one command. It is also great
 for setting up all depended services. Docker Compose can setup things like Cassandra,
 PostgreSQL and RabbitMQ easily!

**But...** it's not a good idea to develop the project inside of it. Changes in the
 code will require rebuilding whole Docker images. Instead, consider using Vagrant
 or setup the project natively on Linux/macOS.

### Requirements

 - [Docker CE](https://www.docker.com/community-edition),
 - [Docker Compose](https://docs.docker.com/compose/install/).

_**TIP!**_ Check your host machine with these commands:

```bash
$ docker --version
Docker version 17.09.1-ce, build 19e2cf6
$ docker-compose --version
docker-compose version 1.17.1, build 6d101fb
```

### How to setup whole MedTagger?

To run whole MedTagger (with all dependencies) using Docker Compose, you can just execute `up` command like this:

```bash
$ docker-compose up
```

By default, Docker-Compose will set up latest stable version of MedTagger. You can also setup and instance
 with different version using appropriate environment variable:

```bash
$ export MEDTAGGER_VERSION=1.0.1
$ docker-compose up
``` 

_**TIP!**_ Add `-d` (detach) option to run everything in the background!

### How to scale MedTagger with multiple containers?

MedTagger was designed to be as much scalable as possible. As an administrator you can define how many
 containers you would like to run for each of our service. Whole load will be balanced across all
 available resources. To do so, you can run:

```bash
$ docker-compose up -d \
   --scale medtagger_backend_websocket=4 \
   --scale medtagger_backend_rest=2 \
   --scale medtagger_backend_worker=2 \
   --scale medtagger_frontend=2
```

Remember that each service may run on multiple processes on its own, so be reasonable about
 resource allocation!

### How to upgrade MedTagger in Docker?

To upgrade MedTagger using Docker Compose you can pull new images for given version and restart running
 containers. It may look like this:

```bash
$ export MEDTAGGER_VERSION=1.0.1
$ export MEDTAGGER_SERVICES_TO_UPGRADE="medtagger_frontend medtagger_backend_rest \
medtagger_backend_websocket medtagger_backend_worker medtagger_backend_database_migrations"
$ docker-compose pull 
$ docker-compose down
$ docker-compose up -d --no-deps $MEDTAGGER_SERVICES_TO_UPGRADE
$ docker-compose rm $MEDTAGGER_SERVICES_TO_UPGRADE
```

### How to setup only dependencies?

It's really easy to start all needed external dependencies with:

```bash
$ docker-compose up -d cassandra postgres rabbitmq
```

For more information about usage please read the [documentation](https://docs.docker.com/compose/).

### How to setup MedTagger on subdirectory?

To run MedTagger on a subdirectory export `MEDTAGGER__HOST_ON_SUBDIRECTORY` environment variable
 and run Docker-Compose in the same way as it was done above.

**NOTE:** Always start your subdirectory with slash `/`! But do not end with it!
 
Here is an example how to do this:

```bash
# Frontend & Backend will be hosted under below subdirectory
$ export MEDTAGGER__HOST_ON_SUBDIRECTORY=/medtagger

# Now, you will be able to build & run your containers
$ docker-compose up ...
```

### Monitoring

Your MedTagger instance can be monitored with [Netdata](https://docs.netdata.cloud).
 Default configuration was defined in the Docker-Compose file, so it will be run
 together with all other Docker containers. If needed, Netdata can be used to collect
 data from multiple nodes in your cluster, which required additional configuration
 as described [here](https://docs.netdata.cloud/streaming/#monitoring-ephemeral-nodes).

Netdata UI will be available under `http://localhost:19999/`.

### How to speed up Cassandra Driver?

By default MedTagger will use only Python implementation for Cassandra Driver. But authors of this
 library provided us with couple of switches that can be used to compile its library for your
 server and add some extentions that can speed up the driver significantly. These flags are
 described [here](https://github.com/datastax/python-driver/blob/master/docs/installation.rst#optional-non-python-dependencies).

To use them with MedTagger, we've provided two environment variables that can be enabled/disabled
 before you will build Docker images:

```bash
# This will enable Cython (by default set to 1)
$ export CASSANDRA_DRIVER__DISABLE_CYTHON=0

# This will enable extentions (by default set to 1)
$ export CASSANDRA_DRIVER__DISABLE_EXTENTIONS=0

# Now, you will be able to build & run your containers
$ docker-compose up ...
```

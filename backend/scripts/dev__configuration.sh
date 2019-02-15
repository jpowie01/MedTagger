#!/usr/bin/env bash
export MEDTAGGER__API_HOST="0.0.0.0"
export MEDTAGGER__API_REST_PORT=51000
export MEDTAGGER__API_WEBSOCKET_PORT=51001
export MEDTAGGER__API_DEBUG=1
export MEDTAGGER__API_SECRET_KEY="SECRET_KEY"

export MEDTAGGER__DB_DATABASE_URI="postgresql://medtagger_user:MedTa99er!@localhost/medtagger"
export MEDTAGGER__DB_CONNECTION_POOL_SIZE=25

export MEDTAGGER__STORAGE_BACKEND="filesystem"

export MEDTAGGER__FILESYSTEM_DIRECTORY="/var/medtagger/storage"

export MEDTAGGER__CASSANDRA_ADDRESSES="127.0.0.1"
export MEDTAGGER__CASSANDRA_PORT=9042
export MEDTAGGER__CASSANDRA_DEFAULT_TIMEOUT=30
export MEDTAGGER__CASSANDRA_CONNECT_TIMEOUT=30

export MEDTAGGER__CELERY_BROKER="pyamqp://guest:guest@localhost//"

# Disable Cassandra Driver tweaks - not needed in development setup
export CASS_DRIVER_NO_CYTHON=1
export CASS_DRIVER_NO_EXTENSIONS=1

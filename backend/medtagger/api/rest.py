"""Module responsible for definition of whole application.

It is also a great entry point for running this app. To do so, you can use:

    $ python medtagger/api/app.py
     * Running on http://localhost:51000/ (Press CTRL+C to quit)
     * Restarting with stat
     * Debugger is active!
     * Debugger PIN: XXX-XXX-XXX
"""  # pylint: disable=duplicate-code;  This is one of two application entrypoints
# pylint: disable=unused-import;  It's used by Flask
# pylint: disable=wrong-import-position;  Python logging should be configured ASAP
import logging.config
from typing import Any

# Setup logging as fast as possible, so imported libraries __init__.py will
# be able to log using our configuration of logging
logging.config.fileConfig('logging.conf')
from flask import Flask, current_app  # noqa
from flask_cors import CORS  # noqa

from medtagger.api import blueprint  # noqa
from medtagger.config import AppConfiguration  # noqa
from medtagger.database import session  # noqa
from medtagger.database.models import User, Role  # noqa
from medtagger.storage import create_connection  # noqa

# Import all REST services
from medtagger.api.core.service import core_ns as core_rest_ns  # noqa
from medtagger.api.labels.service import labels_ns  # noqa
from medtagger.api.scans.service_rest import scans_ns as scans_rest_ns  # noqa
from medtagger.api.datasets.service_rest import datasets_ns as datasets_rest_ns  # noqa
from medtagger.api.tasks.service_rest import tasks_ns  # noqa
from medtagger.api.users.service import users_ns  # noqa
from medtagger.api.auth.service import auth_ns  # noqa
from medtagger.api.image_server.service import image_server_ns  # noqa

logger = logging.getLogger(__name__)

# Load configuration
logger.info('Loading configuration file...')
configuration = AppConfiguration()
host = configuration.get('api', 'host', fallback='localhost')
port = configuration.getint('api', 'rest_port', fallback=51000)
debug = configuration.getboolean('api', 'debug', fallback=True)

# Definition of application
app = Flask(__name__)
CORS(app)
app.secret_key = configuration.get('api', 'secret_key', fallback='')
app.register_blueprint(blueprint)

# Application config
app.config['RESTPLUS_MASK_SWAGGER'] = False
app.config['SWAGGER_UI_DOC_EXPANSION'] = 'list'
app.config['RESTPLUS_VALIDATE'] = True
app.config['ERROR_404_HELP'] = False


try:
    # This will raise ModuleNotFoundError if app was not run inside uWSGI server
    from uwsgidecorators import postfork  # noqa

    @postfork
    def connect_to_cassandra() -> None:
        """Create a single Session to Cassandra after fork to multiple processes by uWSGI."""
        create_connection()
except ModuleNotFoundError:
    # It seems that application is not running inside uWSGI server, so let's initialize session
    # in current process as it is highly probable that we are running in Flask's dev server
    create_connection()


@app.teardown_appcontext
def shutdown_session(exception: Any = None) -> None:  # pylint: disable=unused-argument
    """Remove Session on each Request end."""
    session.remove()


if __name__ == '__main__':
    app.run(host=host, port=port, debug=debug)

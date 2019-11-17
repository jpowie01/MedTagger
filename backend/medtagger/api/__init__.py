"""Module responsible for defining API."""
import logging
import traceback
from typing import Tuple, Dict

from flask import Blueprint
from flask_restplus import Api
from flask_socketio import SocketIO, emit

from medtagger import config, storage, database
from medtagger.api.exceptions import UnauthorizedException, InvalidArgumentsException, NotFoundException, \
    AccessForbiddenException

logger = logging.getLogger(__name__)

# Definition of the REST API
authorizations = {
    'token': {
        'type': 'apiKey',
        'in': 'header',
        'name': 'Authorization',
    },
}
blueprint = Blueprint('api', __name__, url_prefix='/api/v1')
api = Api(blueprint, version='0.1', title='Backend API', description='Documentation for Backend API',
          default='core', default_label='Core methods', authorizations=authorizations, validate=True)

# Definition of the WebSocket API
configuration = config.AppConfiguration()
websocket_ping_timeout = configuration.getint('api', 'websocket_ping_timeout', fallback=5)
websocket_ping_interval = configuration.getint('api', 'websocket_ping_interval', fallback=3)
web_socket = SocketIO(logger=True, engineio_logger=True, ping_timeout=websocket_ping_timeout,
                      ping_interval=websocket_ping_interval, cors_allowed_origins='*')


def setup_connection_to_sql_and_storage() -> None:
    """Initialize connection to the SQL DB and Storage."""
    try:
        # This will raise ModuleNotFoundError if app was not run inside uWSGI server
        from uwsgidecorators import postfork  # noqa

        @postfork
        def connect_to_db_and_storage() -> None:  # pylint: disable=unused-variable
            """Create a single Session to DB and Storage after fork to multiple processes by uWSGI."""
            storage.create_connection(use_gevent=True)
            database.engine.dispose()  # Recreate SQL Pool
    except ModuleNotFoundError:
        # It seems that application is not running inside uWSGI server, so let's initialize session
        # in current process as it is highly probable that we are running in Flask's dev server
        storage.create_connection(use_gevent=True)


@api.errorhandler
def rest_default_error_handler(exception: Exception) -> Tuple[Dict, int]:  # pylint: disable=unused-argument
    """Handle all unhandled exceptions.

    :param exception: Python Exception
    :return: tuple with response and status code
    """
    logger.error(traceback.format_exc())
    return {'message': 'An unhandled exception occurred.'}, 500


@api.errorhandler(UnauthorizedException)
def rest_unauthorized_error_handler(exception: Exception) -> Tuple[Dict, int]:
    """Handle unauthorized errors.

    :param exception: Python Exception
    :return: tuple with response and status code
    """
    logger.warning(traceback.format_exc())
    details = str(exception)
    return {'message': 'You are not authorized to use this method.', 'details': details}, 401


@api.errorhandler(NotFoundException)
def rest_not_found_error_handler(exception: Exception) -> Tuple[Dict, int]:
    """Handle not found errors.

    :param exception: Python Exception
    :return: tuple with response and status code
    """
    logger.warning(traceback.format_exc())
    details = str(exception)
    return {'message': 'Requested object does not exist.', 'details': details}, 404


@api.errorhandler(InvalidArgumentsException)
def rest_invalid_arguments_error_handler(exception: Exception) -> Tuple[Dict, int]:
    """Handle invalid arguments errors.

    :param exception: Python Exception
    :return: tuple with response and status code
    """
    logger.warning(traceback.format_exc())
    details = str(exception)
    return {'message': 'Invalid arguments.', 'details': details}, 400


@api.errorhandler(AccessForbiddenException)
def rest_access_forbidden_error_handel(exception: Exception) -> Tuple[Dict, int]:
    """Handle access forbidden errors.

    :param exception: Python Exception
    :return: tuple with response and status code
    """
    logger.warning(traceback.format_exc())
    details = str(exception)
    return {'message': 'Access forbidden', 'details': details}, 403


@web_socket.on_error_default
def web_socket_default_error_handler(exception: Exception) -> None:  # pylint: disable=unused-argument
    """Handle all unhandled exceptions.

    :param exception: Python Exception
    """
    logger.exception('An unhandled exception occurred.')
    emit('error', {'message': 'An unhandled exception occurred.'})

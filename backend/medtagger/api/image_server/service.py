import io
from typing import Any

from flask import send_file
from flask_restplus import Resource

from medtagger.api import api

image_server_ns = api.namespace('image_server', 'Methods related to serving images')


@image_server_ns.route('/<int:z>/<int:y>/<int:x>')
class ImageServer(Resource):

    @staticmethod
    @image_server_ns.produces(['image/png'])
    def get(z: int, y: int, x: int) -> Any:
        with open(f'data/microscope/png/{z}/{y}_{x}.png', 'rb') as image_file:
            return send_file(io.BytesIO(image_file.read()), attachment_filename='image.png', mimetype='image/png')

